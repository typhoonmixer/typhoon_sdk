#[starknet::contract]
pub mod SDK {
    use core::num::traits::Zero;
    use starknet::event::EventEmitter;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry,
        StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{
        ClassHash, ContractAddress, contract_address_const, get_block_timestamp, get_caller_address,
        syscalls,
    };
    use super::super::interfaces::ISDK::ISDK;

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Blacklisted: Blacklisted,
        Upgrade: Upgrade,
        Verified: Verified,
    }

    #[derive(Drop, starknet::Event)]
    struct Upgrade {
        #[key]
        new_classhash: ClassHash,
        owner: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct Blacklisted {
        #[key]
        blacklisted_address: ContractAddress,
        timestamp: u64,
        blacklisted_by: Array<u8>,
    }

    #[derive(Drop, starknet::Event)]
    struct Verified {
        #[key]
        verified_address: ContractAddress,
        timestamp: u64,
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        blacklisted: Map<ContractAddress, bool>,
        verified: Map<ContractAddress, bool>,
        verified_name: Map<ContractAddress, Map<u256, u8>>,
        verified_name_len: Map<ContractAddress, u256>,
    }
    #[constructor]
    fn constructor(ref self: ContractState, _owner: ContractAddress) {
        self.owner.write(_owner);
        self.verified.entry(_owner).write(true);
        let name: [u8; 5] = [111, 119, 110, 101, 114]; // "owner" in utf8
        let name_span = name.span();
        for i in 0..5_u8 {
            self.verified_name.entry(_owner).entry(i.into()).write(*name_span.at(i.into()))
        }
        self.verified_name_len.entry(_owner).write(5);
    }

    #[abi(embed_v0)]
    impl SDK of ISDK<ContractState> {
        fn add_to_blacklist(
            ref self: ContractState, blacklisted_address: ContractAddress, blacklisted: bool,
        ) {
            let caller = get_caller_address();
            assert!(self.verified.read(caller), "is not an verified entity");
            self.blacklisted.entry(blacklisted_address).write(true);
            let mut verified_name: Array<u8> = ArrayTrait::new();
            for i in 0..(self.verified_name_len.entry(caller).read()) {
                verified_name.append(self.verified_name.entry(caller).entry(i).read())
            }
            self
                .emit(
                    Blacklisted {
                        blacklisted_address: blacklisted_address,
                        timestamp: get_block_timestamp(),
                        blacklisted_by: verified_name,
                    },
                )
        }
        fn is_blacklisted(self: @ContractState, account: ContractAddress, verified: bool) -> bool {
            self.blacklisted.entry(account).read()
        }
        fn verify_account(
            ref self: ContractState, account_to_verify: ContractAddress, protocol_name: Span<u8>,
        ) {
            assert!(get_caller_address() == self.owner.read(), "only owner");
            assert!(
                account_to_verify != contract_address_const::<0>(),
                "account to be verified cannot be zero",
            );
            for i in 0..protocol_name.len() {
                self.verified_name.entry(account_to_verify).entry(i.into()).write(*protocol_name[i])
            }
            self.verified_name_len.entry(account_to_verify).write(protocol_name.len().into());
            self.verified.entry(account_to_verify).write(true);
            self
                .emit(
                    Verified {
                        verified_address: account_to_verify, timestamp: get_block_timestamp(),
                    },
                );
        }
        fn is_verified_account(self: @ContractState, account: ContractAddress) -> bool {
            self.verified.entry(account).read()
        }
        fn owner(self: @ContractState) -> ContractAddress {
            return self.owner.read();
        }

        fn set_owner(ref self: ContractState, new_owner: ContractAddress) {
            assert!(new_owner != contract_address_const::<0>(), "New owner cannot be zero address");
            assert!(get_caller_address() == self.owner.read(), "Only owner");
            // [111, 119, 110, 101, 114]
            let name: [u8; 5] = [111, 119, 110, 101, 114]; // "owner" in utf8
            let name_span = name.span();
            for i in 0..5_u8 {
                self.verified_name.entry(self.owner.read()).entry(i.into()).write(0);
                self.verified_name.entry(new_owner).entry(i.into()).write(*name_span.at(i.into()))
            }
            self.verified.entry(self.owner.read()).write(false);
            self.verified.entry(new_owner).write(true);
            self.verified_name_len.entry(self.owner.read()).write(0);
            self.verified_name_len.entry(new_owner).write(5);
            self.owner.write(new_owner);
        }
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            assert!(!new_class_hash.is_zero(), "Class hash cannot be zero");
            assert!(get_caller_address() == self.owner.read(), "Only owner");
            syscalls::replace_class_syscall(new_class_hash).unwrap();
            self.emit(Upgrade { new_classhash: new_class_hash, owner: self.owner.read() });
        }
    }
}
