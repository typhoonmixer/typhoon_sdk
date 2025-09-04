import { TyphoonSDK } from "./index.js";
import { readFile } from "fs/promises";

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

async function getJsonFile() {
    const data = await readFile('./deposit-data.json', "utf8"); // lê como string
    return JSON.parse(data);                   // converte para objeto
}

let data = await getJsonFile()

async function withdraw() {
    sdk.init(data.secrets, data.nullifiers, data.pools)
    let cd = await sdk.get_withdraw_calldata(data.txHash, [receiver]) 
    return cd
}
withdraw().then((data)=>{
    console.log("data ", data.length)
    process.exit(0);
})