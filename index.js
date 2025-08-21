
import { RpcProvider, Contract, constants, types, hash, events, CallData, num, cairo } from 'starknet';
import { ethers } from 'ethers'
import Hasher from './mimc5';
import * as garaga from 'garaga';
import vk from './verification_key.json' assert { type: "json" }
import { parseGroth16ProofFromObject, parseGroth16VerifyingKeyFromObject } from './parsingUtils';
import * as snarkjs from "snarkjs";
import axios from 'axios';

const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_8" });
const typhoonAddress = ""
const PAYMASTER_ADDR = ""

const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);

export class Typhoon {

    constructor(secrets = [], nullifiers = [], pools = []) {
        this.secrets = secrets
        this.nullifiers = nullifiers
        this.pools = pools
        this.sdk_address = ""
    }

    init(secrets, nullifiers, pools) {
        this.secrets = secrets
        this.nullifiers = nullifiers
        this.pools = pools
    }

    get_secrets() {
        return this.secrets
    }

    set_secrets(new_secrets) {
        this.secrets = new_secrets
    }

    get_nullifiers() {
        return this.nullifiers
    }

    set_nullifiers(new_nullifiers) {
        this.nullifiers = new_nullifiers
    }

    get_pools() {
        return this.pools
    }

    set_secrets(new_pools) {
        this.pools = new_pools
    }

    async add_to_blacklist(caller_account, blacklisted_address) {
        const { abi: sdkAbi } = await provider.getClassAt(this.sdk_address);
        const sdk = new Contract(sdkAbi, this.sdk_address, provider)
        const call = sdk.populate('add_to_blacklist', { blacklisted_address: blacklisted_address });
        const multiCall = await caller_account.execute({
            contractAddress: this.sdk_address,
            entrypoint: 'add_to_blacklist',
            calldata: call.calldata,
        });
        await account.waitForTransaction(multiCall.transaction_hash);
    }

    async is_blacklisted(account_address) {
        const { abi: sdkAbi } = await provider.getClassAt(this.sdk_address);
        const sdk = new Contract(sdkAbi, this.sdk_address, provider)
        let is_blacklisted = await sdk.is_blacklisted(account_address)
        return is_blacklisted
    }

    async generate_approve_and_deposit_calls(amount, token_address) {
        let [allowPerPool, poolToDenomination, pools] = await allowancePerPool(amount, token_address)
        let approvalsAndDeposit = []
        let approvals = []
        let deposits = []
        for (let i = 0; i < pools.length; i++) {
            if (allowPerPool["0x" + pools[i].toString(16)] != undefined) {
                approvals.push({
                    contractAddress: token_address,
                    entrypoint: 'approve',
                    calldata: CallData.compile({
                        spender: "0x" + pools[i].toString(16),
                        amount: cairo.uint256(allowPerPool[pools[i]]),
                    }),
                })
                for (let j = 0; j < allowPerPool["0x" + pools[i].toString(16)] / poolToDenomination["0x" + pools[i].toString(16)]; i++) {
                    const [secret, nullifier] = generateSecretAndNullifier()
                    this.secrets.push(secret)
                    this.nullifiers.push(nullifier)
                    this.pools.push("0x" + pools[i].toString(16))
                    const [commitment, _] = await commitmentAndNullifierHash(secret, nullifier)
                    deposits.push({
                        contractAddress: typhoonAddress,
                        entrypoint: 'deposit',
                        calldata: CallData.compile({
                            _commitment: commitment,
                            _pool: "0x" + pools[i].toString(16),
                            _reward: false
                        }),
                    })
                }
            }
        }
        approvalsAndDeposit = approvals.concat(deposits)
        return approvalsAndDeposit
    }

    async withdraw(txhash, receiver_list) {
        for (let i = 0; i < this.secrets.length; i++) {
            let note = { "secret": this.secrets[i], "nullifier": this.nullifiers[i], "pool": this.pools[i], "txHash": txhash }
            let callData = await generateProofCalldata(note, receiver_list[i % receiver_list.length])
            let cd = callData.map(x => x.toString())
            try {
                const res = await axios.post("https://typhoon-paymaster.vercel.app/calldata", {
                    calldata: cd,
                    note_account_calldata: {}
                });
                console.log("Response:", res.data);
            } catch (err) {
                console.error("Error:", err.response?.data || err.message);
            }
        }
    }
}

async function generateProofCalldata(note, recipient) {
    await garaga.init();

    const typhoon = new Contract(typhoonAbi, typhoonAddress, provider);

    let receipt = await provider.waitForTransaction(note.txHash)

    let [commitment, nullifierHash] = await commitmentAndNullifierHash(note.secret, note.nullifier)

    let depositEvent = {}
    for(let i = 0; i < typhoon.parseEvents(receipt).length; i++){
        let event = typhoon.parseEvents(receipt)[i]["typhoon::Typhoon::Typhoon::Deposit"]
        if(event.commitments == commitment){
            depositEvent = event
            break
        }
    }

    const lastBlock = await provider.getBlock('latest');
    const keyFilter = [[num.toHex(hash.starknetKeccak('Add'))]];
    let parsedAddEvents = await getAddEvents(Number(receipt.block_number), lastBlock.block_number, note.pool, keyFilter)

    let [C, RL, currentLevel, count] = await getCandRl(depositEvent.leafs, parsedAddEvents, note.pool, Number(receipt.block_number))
    let filteredleafs = depositEvent.leafs.filter(val => val != 0n)
    let D = getD(parsedAddEvents, depositEvent.d, filteredleafs[filteredleafs.length - 1])

    let dd = getDD(D, currentLevel)

    let denomination = await getPoolDenomination(note.pool)
    let relayerFee = (denomination / 100n) * 2n
    let relayer = BigInt(PAYMASTER_ADDR)


    let proofInput = {
        "nullifierHash": nullifierHash,
        "day": BigInt(1),
        "recipient": BigInt(recipient),
        "relayer": relayer,
        "relayerFee": relayerFee,
        "secret": BigInt(note.secret),
        "nullifier": BigInt(note.nullifier),
        "count": count + 1n,
        "dd": dd,
        "D": D,
        "rootLv": currentLevel,
        "RL": RL,
        "C": C
    }
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(proofInput, "withdraw.wasm", "withdraw_0001.zkey");

    let parsedProof = parseGroth16ProofFromObject(proof, publicSignals.map(x => BigInt(x)))

    let parsedVK = parseGroth16VerifyingKeyFromObject(vk)
    const groth16Calldata = garaga.getGroth16CallData(parsedProof, parsedVK, garaga.CurveId.BN254);

    // The first element of the calldata is "length" and is not compatible with Cairo 1.0, so it is removed
    groth16Calldata[0] = note.pool

    return groth16Calldata
}

async function getPoolDenomination(poolAddress) {
    const { abi: poolAbi } = await provider.getClassAt(poolAddress);
    const poolContract = new Contract(poolAbi, poolAddress, provider);
    const denomination = await poolContract.denomination();
    return denomination;
}

async function fetchLevel(block_number, level, lvFullIndex, pool) {

    const keyFilter = [[num.toHex(hash.starknetKeccak('Add'))]];
    // 1309463 is the block where typhoon got deployed
    let events = await getAddEvents(1671756, block_number, pool, keyFilter)

    let filteredEvents = events.filter(val => val.level == level)

    let levelArr = []
    let ll = lvFullIndex % 4n
    console.log(filteredEvents)
    for (let i = 0; i < Number(ll.toString()); i++) {
        levelArr[i] = filteredEvents[(filteredEvents.length - 1) - i].value
    }
    return levelArr
}

async function getAddEvents(from_block_number, to_block_number, pool, filter) {
    const lastBlock = await provider.getBlock('latest');
    const keyFilter = [[num.toHex(hash.starknetKeccak('Add'))]];
    let allEvents = []
    let continuationToken = '0';
    while (continuationToken != undefined) {
        const eventsList = await provider.getEvents({
            address: pool,
            from_block: { block_number: from_block_number },
            to_block: { block_number: to_block_number },
            keys: filter,
            chunk_size: 1000,
            continuation_token: continuationToken === '0' ? undefined : continuationToken,
        });
        continuationToken = eventsList.continuation_token;
        allEvents = allEvents.concat(eventsList.events)
    }

    const { abi: poolAbi } = await provider.getClassAt(pool);
    const abiEvents = events.getAbiEvents(poolAbi);
    const abiStructs = CallData.getAbiStruct(poolAbi);
    const abiEnums = CallData.getAbiEnum(poolAbi);
    const parsed = events.parseEvents(allEvents, abiEvents, abiStructs, abiEnums);

    return parsed.map((e) => e["typhoon::Pool::Pool::Add"])
}

function getDD(d, h) {
    let D = d.filter(val => val != 0n)
    D = D.reverse()
    let dd = hashListH2(D, D.length)
    return dd;
}

function getD(addEvents, baseD, leaf) {
    let D = Array(127).fill(0n)
    let bd = baseD.filter(val => val != 0n)
    let startIndex = 0;
    for (let i = 0; i < addEvents.length; i++) {
        if (addEvents[i].value == leaf) {
            startIndex = i
            break
        }
    }

    for (let i = 0; i < bd.length; i++) {
        D[i] = bd[i]
    }

    if (addEvents[startIndex + 1] == undefined) {
        return D
    }

    for (let i = startIndex + 1; i < addEvents.length; i++) {
        let ll = addEvents[i].lvFullIndex % 4n
        D[addEvents[i].level] = ll == 0n ? addEvents[i].value : hashListH2([D[addEvents[i].level], addEvents[i].value], 2)
    }
    return D
}

function hashListH2(input, len) {
    let hasher = new Hasher()
    let h = BigInt(input[0]);
    for (let i = 1; i < len; i++) {
        h = hasher.MiMC5Sponge([h.toString(), input[i].toString()], '0');
    }
    return h;
}

async function getCandRl(leafs, addEvents, pool, block_number) {

    let C = [];
    let RL = []
    let leafLevel = []
    let count = 0n

    leafLevel = leafs.filter(val => val != 0n)

    let currentLevel = 0n
    let currentLL = leafLevel.length


    RL = [...leafs]
    C.push([leafs[0], leafs[1], leafs[2], leafs[3]])
    for (let i = 0; i < 125; i++) {
        C.push(Array(4).fill(0n))
    }

    let leafIndex = 0
    for (let i = 0; i < addEvents.length; i++) {
        if (addEvents[i].value == leafs[currentLL - 1]) {
            leafIndex = i
            count = addEvents[i].lvFullIndex
            break
        }
    }

    for (let i = leafIndex + 1; i < addEvents.length; i++) {
        if (addEvents[i].level == 0n) {
            count = addEvents[i].lvFullIndex
        }
        if (C[currentLevel][3] != 0n) {
            currentLevel += 1n;
        }
        if (addEvents[i].level == currentLevel) {
            let ll = addEvents[i].lvFullIndex % 4n
            if (ll == 0n) {
                C[currentLevel][0] = addEvents[i].value
                RL = C[currentLevel]
            } else if (ll != 0n && C[currentLevel][ll - 1n] != 0n) {
                C[currentLevel][ll] = addEvents[i].value
                RL = C[currentLevel]
            } else {
                let previousRoots = await fetchLevel(block_number, addEvents[i].level, addEvents[i].lvFullIndex, pool)
                if (!previousRoots.includes(addEvents[i].value)) {
                    previousRoots[ll] = addEvents[i].value
                }

                RL = [0n, 0n, 0n, 0n]
                for (let j = 0; j < previousRoots.length; j++) {
                    RL[j] = previousRoots[j]
                }
                C[currentLevel][0] = addEvents[i].value
            }
        }

    }

    return [C, RL, currentLevel, count]
}


async function allowancePerPool(amount, token_address) {
    let [poolsDenominations, denominationToPool, poolToDenomination, pools] = await getPoolsDenomination(token_address)
    poolsDenominations.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    let poolsAllowance = {}
    let res = amount
    for (let i = 0; i < poolsDenominations; i++) {
        let aux = 0n
        if (res >= poolsDenominations[i]) {
            aux = res % poolsDenominations[i]
            poolsAllowance[denominationToPool[poolsDenominations[i]]] = res - aux
            res = aux
        }
    }

    return [poolsAllowance, poolToDenomination, pools]
}

async function getPoolsDenomination(token_address) {
    const typhoon = new Contract(typhoonAbi, typhoonAddress, provider);
    const pools = await typhoon.getTokensByPool(token_address)
    let poolsDenominations = []
    let denominationToPool = {}
    let poolToDenomination = {}

    for (let i = 0; i < pools.length; i++) {
        let denomination = await getPoolDenomination("0x" + pools[i].toString(16))
        poolsDenominations[i] = denomination
        denominationToPool[denomination] = "0x" + pools[i].toString(16)
        poolToDenomination["0x" + pools[i].toString(16)] = denomination
    }
    return [poolsDenominations, denominationToPool, poolToDenomination, pools]
}

export async function commitmentAndNullifierHash(secret, nullifier) {
    const input = {
        secret: BigInt(secret),
        nullifier: BigInt(nullifier)
    };
    var res = await fetch("deposit.wasm");
    var buffer = await res.arrayBuffer();

    var depositWC = await wc(buffer);

    const r = await depositWC.calculateWitness(input, 0);

    const commitment = r[1];
    const nullifierHash = r[2];

    return [commitment, nullifierHash]
}

function generateSecretAndNullifier() {
    const secret = uint8ArrayTo256BitBigInt(ethers.randomBytes(32)).toString();
    const nullifier = uint8ArrayTo256BitBigInt(ethers.randomBytes(32)).toString();
    return [secret, nullifier]
}

function uint8ArrayTo256BitBigInt(uint8Array) {
    if (uint8Array.length !== 32) {
        throw new Error("Uint8Array must be exactly 32 bytes for a 256-bit integer.");
    }

    let result = BigInt(0);
    for (const byte of uint8Array) {
        result = (result << BigInt(8)) + BigInt(byte);
    }

    return result;
}