import { TyphoonSDK } from "./index.js";
import { readFile } from "fs/promises";
import { RpcProvider, Account, Contract, num, json, ec, stark, uint256, shortString, hash, CallData, AccountInterface, constants, eth } from 'starknet';
import dotenv from 'dotenv'

dotenv.config()

debugger;
let sdk = new TyphoonSDK()
let receiver = "0x03f2039a5c1742f8d90985eabaddf691090176511ebe9d3bcd042b1914918e64"

// let secret = "92617402298559269065086104721880440476282606017444505233862012920354257089666"
// let nullifier = "898800535067574212796020106946633551010566464190048684181079557359336601232"
// let pool = "0x414ad2979b3d4b855fd47e88b3927cc260d0337e72e9be16cb19196aabda17a"
// let txhash = "0x6d9d435182b23d8dedde14f11c38f471c1b95f353845dfcbb6431804b698a4e"
// let withdraw_txhash = "0x22e60711d006f34f74e52765f2ee4305270b86e410912d3bf6f7ed80c4c244e"
// let strk = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
// let complianceData = await sdk.get_compliance_data(secret,nullifier, txhash, pool)
// // let transferEvents = await getTransfers(withdraw_txhash,pool)
// // console.log("trasfers ", transferEvents)
// console.log("compliance data ", complianceData)

const provider = new RpcProvider({ nodeUrl: "https://rpc.starknet-testnet.lava.build:443" });
const accAddress = "0x014c78b080b3e8b9d56ea74f05acdd9de473894998319761619eec15d415fa0a"
const argentPrivKey = "0x0356325d51ffbc99281a535907b6d865d10fa641937b6ff85026a5f87245690f"
const argentAddr = "0x04259a8f1F05fDA7F2365e1D629f9dBaE203685272bF87D8Ef8853eB2745fB30"
const account = new Account(provider, argentAddr, argentPrivKey);
const strkAddress = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
// let depositCalls = await sdk.generate_approve_and_deposit_calls(BigInt('110'+'0'.repeat(18)), strkAddress)

// let res = await account.execute(depositCalls)
// await provider.waitForTransaction(res.transaction_hash);
// await sdk.download_notes(res.transaction_hash)

// async function getJsonFile() {
//     const data = await readFile('./deposit-data.json', "utf8"); // lê como string
//     return JSON.parse(data);                   // converte para objeto
// }

const data = await readFile('./note.json', "utf8");
const note = JSON.parse(data)
console.log(note)

let secrets = []
let nullifiers = []
let pools = []
let txHash = note[0].txHash

for (let i = 0; i < note.length; i++) {
    secrets.push(note[i].secret)
    nullifiers.push(note[i].nullifier)
    pools.push(note[i].pool)
}

sdk.init(secrets, nullifiers, pools)
let tm = sdk.get_typedMessage()
let sig = await account.signMessage(tm)
let privText = Array.from("head").map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')
let genPrivKey = hash.computePoseidonHash(hash.computePoseidonHash(sig.r, sig.s), BigInt('0x' + privText))
let validacc = await sdk.get_valid_anonymous_accounts(genPrivKey, accAddress, "argentX")
console.log("valid accounts ",validacc)
// let genPrivKey = hash.computePoseidonHash(hash.computePoseidonHash(sig.r, sig.s), BigInt('0x' + privText))
// let genPubKey = ec.starkCurve.getStarkKey(genPrivKey);


// let anoncalls = await sdk.withdraw_to_anonymous_account(txHash, genPrivKey, false, accAddress, "argentX")


// let typhoonAddress = "0x52a456d2a77f5b56cbe5411e7ebdff992a62937e94e28f4399c587895305fb5"
// const { abi: typhoonAbi } = await provider.getClassAt(typhoonAddress);
// const typhoonContract = new Contract(typhoonAbi, typhoonAddress, account);
// for (let i = 0; i < anoncalls.length; i++) {
//     try {
//         const call = typhoonContract.populate('withdraw', { full_proof_with_hints: anoncalls[i] });
//         const multiCall = await account.execute({
//             contractAddress: typhoonAddress,
//             entrypoint: 'withdraw',
//             calldata: call.calldata,
//         });
//         await account.waitForTransaction(multiCall.transaction_hash);
//     } catch (error) {
//         console.error("Error on withdraw: ", error.baseError.data.execution_error.error);
//     }
// }

// let validacc1 = await sdk.get_valid_anonymous_accounts(sig.s, sig.r, accAddress)
// console.log("valid accounts: ", validacc)

let pk = "0xa24835427e0188877170c06105b90570106c30603bd3bc0df7fdeaa2c80bc9"
let h = hash.computePoseidonHashOnElements([pk])


// Step 3: Compute salt (public key as felt)
// const salt = BigInt(pk);
// let CLASS_HASH = "0x03d16c7a9a60b0593bd202f660a28c5d76e0403601d9ccc7e4fa253b6a70c201"
// console.log("genPubKey ", genPubKey)
// let addr = hash.calculateContractAddressFromHash(
//     BigInt(genPubKey),
//     BigInt(CLASS_HASH),
//     [genPubKey],
//     BigInt("0x0")
// )
// console.log("addr ", addr)

// let readyaddr = hash.calculateContractAddressFromHash(
//     BigInt(genPubKey),
//     BigInt("0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f"),
//     ["0",genPubKey, "1"],
//     BigInt("0x0")
// )
// console.log("gen priv key ", genPrivKey)
// console.log("argent addr ", readyaddr)


// let class_hash = await provider.getClassHashAt(addr)
// console.log("class hash ", class_hash)


// let anoncalls = await sdk.withdraw_to_anonymous_account(txHash,)
// let data = await getJsonFile()

// async function withdraw() {
//     sdk.init(data.secrets, data.nullifiers, data.pools)
//     let cd = await sdk.get_withdraw_calldata(data.txHash, [receiver]) 
//     return cd
// }
// withdraw().then((data)=>{
//     console.log("data ", data.length)
//     process.exit(0);
// })

