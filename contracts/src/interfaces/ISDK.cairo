use starknet::{ClassHash};

use starknet::{ContractAddress};
#[starknet::interface]
pub trait ISDK<TContractState> {
    fn add_to_blacklist(ref self: TContractState, blacklisted_address: ContractAddress, blacklisted: bool);
    fn is_blacklisted(self: @TContractState, account: ContractAddress) -> bool;
    fn verify_account(ref self: TContractState, account_to_verify: ContractAddress, protocol_name: Span<u8>, verified: bool);
    fn is_verified_account(self: @TContractState, account: ContractAddress) -> bool;
    fn set_owner(ref self: TContractState, new_owner: ContractAddress);
    fn owner(self: @TContractState) -> ContractAddress;
    fn upgrade(ref self: TContractState, new_class_hash: ClassHash);
}