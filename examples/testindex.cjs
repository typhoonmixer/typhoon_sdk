const tsdk = require("../dist/typhoon-sdk.cjs.js");
const starknet = require("starknet")
// import { RpcProvider, Account, Contract, json, stark, uint256, shortString, CallData, AccountInterface, constants, cairo } from 'starknet';
const fs = require('fs');
const dotenv =  require('dotenv')

dotenv.config()

const provider = new starknet.RpcProvider({ nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_8" });

const accAddress = "0x14c78b080b3e8b9d56ea74f05acdd9de473894998319761619eec15d415fa0a"
console.log("prov key ", process.env.PRIVATE_KEY)
const account = new starknet.Account(provider, accAddress, process.env.PRIVATE_KEY);

let sdk = new tsdk.TyphoonSDK()

const dd = require('../deposit-data.json')

async function withdraw() {
    sdk.init(dd.secrets, dd.nullifiers, dd.pools)
    await sdk.withdraw(dd.txHash, [accAddress]) 
}

withdraw().then(()=>{
    process.exit(0);
})

// async function getCalls() {
//     return await sdk.generate_approve_and_deposit_calls(BigInt('215' + '0'.repeat(18)), "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d")
// }
// getCalls().then(async (calls) => {
//     console.log(calls)
    
//     const multiCall = await account.execute(calls);

//     await account.waitForTransaction(multiCall.transaction_hash);

//     const jsonString = JSON.stringify({ "secrets": sdk.get_secrets(), "nullifiers": sdk.get_nullifiers(), "pools": sdk.get_pools(), "txHash": multiCall.transaction_hash }, null, 2); // The third argument adds indentation for readability

//     // Write the JSON string to a file
//     fs.writeFile('deposit-data.json', jsonString, 'utf8', (err) => {
//         if (err) {
//             console.error('An error occurred while writing JSON Object to File:', err);
//         } else {
//             console.log('JSON file has been saved.');
//         }
//     });
// })
