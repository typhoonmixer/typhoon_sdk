
import { RpcProvider, Contract, constants, types, hash, events, CallData, num, cairo } from 'starknet';
import { ethers } from 'ethers'
import Hasher from './mimc5.js';
import * as garaga from 'garaga';
import { vk } from './verification_key.js';
import * as parser from './parsingUtils.cjs';
import * as snarkjs from "snarkjs";
import axios from 'axios';
import * as wc from './witness_calculator.cjs';

const RPC_URL = "https://rpc.starknet.lava.build:443"
const provider = new RpcProvider({ nodeUrl: RPC_URL });
const typhoonAddress = "0x1f902d238fc1f371688b63323ca9c9eaac7a3f43eb6ef330377f60d0a9f9102"
const PAYMASTER_ADDR = "0x03f2039a5c1742f8d90985eabaddf691090176511ebe9d3bcd042b1914918e64"
const SDK_ADDRESS = "0x1d585985a5f0e75567e63cb7066397e977bcd94f97a9ef01e1dee8b2c564be2"


export class TyphoonSDK {

    constructor() {
        this.secrets = []
        this.nullifiers = []
        this.pools = []
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

    set_pools(new_pools) {
        this.pools = new_pools
    }

    async withdraw_fee_by_token(token_address) {
        const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);
        const typhoon = new Contract(typhoonAbi, typhoonAddress, provider);
        const pools = await typhoon.getTokensByPool(token_address)
        const { abi: poolAbi } = await provider.getClassAt("0x" + pools[0].toString(16));
        const poolContract = new Contract(poolAbi, "0x" + pools[0].toString(16), provider);
        let denomination = await poolContract.denomination();
        let withdrawFee = await poolContract.withdrawFee();
        let fee = (100 * Number(withdrawFee)) / Number(denomination)
        return fee
    }

    async get_compliance_data(secret, nullifier, txhash, pool) {
        const { abi: poolAbi } = await provider.getClassAt(pool);
        const poolContract = new Contract(poolAbi, pool, provider);
        let [commitment, nullifierHash] = await commitmentAndNullifierHash(secret, nullifier)
        let isSpent = await poolContract.isSpent(nullifierHash)
        let denomination = await poolContract.denomination();
        const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);
        const typhoon = new Contract(typhoonAbi, typhoonAddress, provider);
        let receipt = await provider.waitForTransaction(txhash)

        let depositEvent = {}
        for (let i = 0; i < typhoon.parseEvents(receipt).length; i++) {
            let event = typhoon.parseEvents(receipt)[i]["typhoon::Typhoon::Typhoon::Deposit"]
            if (event.commitments == commitment) {
                depositEvent = event
                break
            }
        }
        let tx = await provider.getTransactionByHash(txhash)

        if (!isSpent) {
            let ComplianceObject = {
                depositAmount: denomination.toString(),
                depositDate: depositEvent.timestamps.toString(),
                depositTxHash: txhash,
                from: tx.sender_address,
                commitment: commitment.toString(),
                withdrawAmount: '',
                withdrawDate: '',
                withdrawTxHash: '',
                to: '',
                nullifierHash: '',
                fee: '',
                paymasterFee: ''
            }
            return ComplianceObject
        } else {
            let [eventData, txHash] = await getWithdrawEvent(receipt.value.block_number, nullifierHash, pool)
            let withdraw_receipt = await provider.waitForTransaction(txHash)
            const block = await provider.getBlock(withdraw_receipt.value.block_hash);
            let transferEvents = await getTransfers(txHash, pool)

            let fee = denomination - (transferEvents[0].value + transferEvents[1].value)
            let ComplianceObject = {
                depositAmount: denomination.toString(),
                depositDate: depositEvent.timestamps.toString(),
                depositTxHash: txhash,
                from: tx.sender_address,
                commitment: '0x' + commitment.toString(16),
                withdrawAmount: transferEvents[0].value.toString(),
                withdrawDate: block.timestamp.toString(),
                withdrawTxHash: txHash,
                to: '0x' + BigInt(eventData.recipient).toString(16),
                nullifierHash: '0x' + nullifierHash.toString(16),
                fee: fee.toString(),
                paymasterFee: transferEvents[1].value.toString()
            }
            return ComplianceObject
        }
    }

    async download_notes(txhash) {
        let proofsElements = []
        for (let i = 0; i < this.secrets.length; i++) {
            proofsElements.push(
                JSON.stringify({
                    "secret": this.secrets[i],
                    "nullifier": this.nullifiers[i],
                    "txHash": txhash,
                    "pool": this.pools[i],
                    "day": '1'
                })
            )
        }
        if (typeof window === "undefined") {
            const fs = await import('fs/promises');
            // Write the JSON string to a file
            await fs.writeFile('note.txt', proofsElements.join('\n'), 'utf8', (err) => {
                if (err) {
                    console.error('An error occurred while writing notes to File:', err);
                } else {
                    console.log('note file has been saved.');
                }
            });
        } else {
            createAndDownloadFile(proofsElements.join('\n'))
        }
    }

    async get_token_minimal_amount(token_address) {
        const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);
        const typhoon = new Contract(typhoonAbi, typhoonAddress, provider);
        const pools = await typhoon.getTokensByPool(token_address)
        let poolsDenominations = []

        for (let i = 0; i < pools.length; i++) {
            let denomination = await getPoolDenomination("0x" + pools[i].toString(16))
            poolsDenominations[i] = denomination
        }
        poolsDenominations.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
        return poolsDenominations[poolsDenominations.length - 1]
    }

    async add_to_blacklist(caller_account, blacklisted_address) {
        const { abi: sdkAbi } = await provider.getClassAt(SDK_ADDRESS);
        const sdk = new Contract(sdkAbi, SDK_ADDRESS, provider)
        const call = sdk.populate('add_to_blacklist', { blacklisted_address: blacklisted_address });
        const multiCall = await caller_account.execute({
            contractAddress: SDK_ADDRESS,
            entrypoint: 'add_to_blacklist',
            calldata: call.calldata,
        });
        await account.waitForTransaction(multiCall.transaction_hash);
    }

    async is_blacklisted(account_address) {
        const { abi: sdkAbi } = await provider.getClassAt(SDK_ADDRESS);
        const sdk = new Contract(sdkAbi, SDK_ADDRESS, provider)
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
                        amount: cairo.uint256(allowPerPool["0x" + pools[i].toString(16)]),
                    }),
                })
                for (let j = 0n; j < allowPerPool["0x" + pools[i].toString(16)] / poolToDenomination["0x" + pools[i].toString(16)]; j += 1n) {
                    const [secret, nullifier] = generateSecretAndNullifier()
                    this.secrets.push(secret)
                    this.nullifiers.push(nullifier)
                    this.pools.push("0x" + pools[i].toString(16))
                    const [commitment, _] = await commitmentAndNullifierHash(secret, nullifier)
                    deposits.push({
                        contractAddress: typhoonAddress,
                        entrypoint: 'deposit',
                        calldata: CallData.compile({
                            _commitment: cairo.uint256(commitment),
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

    async get_withdraw_calldata(txhash, receiver_list) {
        let withdraw_calls = []
        for (let i = 0; i < this.secrets.length; i++) {
            let note = { "secret": this.secrets[i], "nullifier": this.nullifiers[i], "pool": this.pools[i], "txHash": txhash }
            let callData = await generateProofCalldata(note, receiver_list[i % receiver_list.length])
            let cd = callData.map(x => x.toString())
            withdraw_calls.push(cd)
        }
        return withdraw_calls
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
                return false
            }
        }
        return true
    }
}

async function getTransfers(txhash, pool) {
    const { abi: poolAbi } = await provider.getClassAt(pool);
    const poolc = new Contract(poolAbi, pool, provider);
    const token = await poolc.token()
    const { abi: tokenAbi } = await provider.getClassAt('0x' + token.toString(16));
    const tokenc = new Contract(tokenAbi, '0x' + token.toString(16), provider);
    let receipt = await provider.waitForTransaction(txhash)
    let parsedEvents = tokenc.parseEvents(receipt)
    let events = []
    for (let i = 0; i < parsedEvents.length; i++) {
        if (parsedEvents[i]['src::strk::erc20_lockable::ERC20Lockable::Transfer'] != undefined) {
            events.push(parsedEvents[i]['src::strk::erc20_lockable::ERC20Lockable::Transfer'])
        }
    }
    events.pop()
    return events
}



function createAndDownloadFile(content, name = "note.txt") {
    const fileContent = content;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = name;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

async function generateProofCalldata(note, recipient) {
    await garaga.init();
    const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);
    const typhoon = new Contract(typhoonAbi, typhoonAddress, provider);

    let receipt = await provider.waitForTransaction(note.txHash)

    let [commitment, nullifierHash] = await commitmentAndNullifierHash(note.secret, note.nullifier)

    let depositEvent = {}
    for (let i = 0; i < typhoon.parseEvents(receipt).length; i++) {
        let event = typhoon.parseEvents(receipt)[i]["typhoon::Typhoon::Typhoon::Deposit"]
        if (event.commitments == commitment) {
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

    let parsedProof = {}
    if (typeof window === "undefined") {
        const fs = await import('fs/promises');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const wasmPath = path.join(__dirname, 'withdraw.wasm');
        const zkeyPath = path.join(__dirname, 'withdraw_0001.zkey');
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(proofInput, wasmPath, zkeyPath);
        parsedProof = parser.parseGroth16ProofFromObject(proof, publicSignals.map(x => BigInt(x)))
    } else {
        const wasmUrl = new URL("./withdraw.wasm", import.meta.url).href;
        const zkeyUrl = new URL("./withdraw_0001.zkey", import.meta.url).href;
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(proofInput, wasmUrl, zkeyUrl);
        parsedProof = parser.parseGroth16ProofFromObject(proof, publicSignals.map(x => BigInt(x)))
    }


    let parsedVK = parser.parseGroth16VerifyingKeyFromObject(vk)
    const groth16Calldata = garaga.getGroth16CallData(parsedProof, parsedVK, garaga.CurveId.BN254);

    // The first element of the calldata is "length" and is not compatible with Cairo 1.0, so it is removed
    groth16Calldata[0] = note.pool

    return groth16Calldata
}

async function getWithdrawEvent(from_block_number, nullifierHash, pool) {
    const lastBlock = await provider.getBlock('latest');
    const keyFilter = [[num.toHex(hash.starknetKeccak('Withdraw'))]];

    let continuationToken = '0';
    let withdrawEvent = []
    while (continuationToken != undefined) {
        const eventsList = await provider.getEvents({
            address: pool,
            from_block: { block_number: from_block_number },
            to_block: { block_number: lastBlock.block_number },
            keys: keyFilter,
            chunk_size: 1000,
            continuation_token: continuationToken === '0' ? undefined : continuationToken,
        });
        continuationToken = eventsList.continuation_token;
        for (let i = 0; i < eventsList.events.length; i++) {
            let eventNullifierHash = BigInt(eventsList.events[i].data[1] + eventsList.events[i].data[0].slice(2))
            if (nullifierHash == eventNullifierHash) {
                withdrawEvent.push(eventsList.events[i])
                break;
            }
        }
    }
    const { abi: poolAbi } = await provider.getClassAt(pool);
    const abiEvents = events.getAbiEvents(poolAbi);
    const abiStructs = CallData.getAbiStruct(poolAbi);
    const abiEnums = CallData.getAbiEnum(poolAbi);
    const parsed = events.parseEvents(withdrawEvent, abiEvents, abiStructs, abiEnums);

    return [parsed.map((e) => e["typhoon::Pool::Pool::Withdraw"])[0], withdrawEvent[0].transaction_hash]
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

    debugger;
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
        if (C[currentLevel][3] != 0n && addEvents[i].level > currentLevel) {
            currentLevel += 1n;
            C[currentLevel][addEvents[i].lvFullIndex % 4n] = addEvents[i].value
            let filteredEvents = addEvents.filter(val => val.level == currentLevel && val.lvFullIndex < addEvents[i].lvFullIndex)
            let nonZeroIndex = addEvents[i].lvFullIndex
            for (let j = filteredEvents.length - 1; j > 0; j--) {
                C[currentLevel][filteredEvents[j].lvFullIndex % 4n] = filteredEvents[j].value
                nonZeroIndex = filteredEvents[j].lvFullIndex
            }
            if (C[currentLevel][0] == 0n) {
                let previousRoots = await fetchLevel(block_number, currentLevel, nonZeroIndex, pool)

                previousRoots.reverse()
                for (let j = 0; j < previousRoots.length; j++) {
                    C[currentLevel][j] = previousRoots[j]
                }
            }

        }
        if (addEvents[i].level == currentLevel) {
            let ll = addEvents[i].lvFullIndex % 4n
            if (ll == 0n) {
                C[currentLevel][0] = addEvents[i].value
                RL = C[currentLevel]
            } else if (ll != 0n && C[currentLevel][ll - 1n] != 0n) {
                C[currentLevel][ll] = addEvents[i].value
                RL = C[currentLevel]
            } else if (C[currentLevel][0] == 0n) {

                let previousRoots = await fetchLevel(block_number, addEvents[i].level, addEvents[i].lvFullIndex, pool)

                if (!previousRoots.includes(addEvents[i].value)) {
                    previousRoots[ll] = addEvents[i].value

                }
                RL = [0n, 0n, 0n, 0n]
                for (let j = 0; j < previousRoots.length; j++) {
                    RL[j] = previousRoots[j]
                }
                C[currentLevel] = previousRoots
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
    for (let i = 0; i < poolsDenominations.length; i++) {
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
    const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);
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

async function commitmentAndNullifierHash(secret, nullifier) {
    const input = {
        secret: BigInt(secret),
        nullifier: BigInt(nullifier)
    };
    let buffer;
    if (typeof window === "undefined") {
        const fs = await import('fs/promises');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const wasmPath = path.join(__dirname, 'deposit.wasm');
        // Read the file as a buffer
        buffer = await fs.readFile(wasmPath);
    } else {
        const wasmUrl = new URL("./deposit.wasm", import.meta.url).href;
        var res = await fetch(wasmUrl);
        buffer = await res.arrayBuffer();
    }

    var depositWC = await wc.default(buffer);

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