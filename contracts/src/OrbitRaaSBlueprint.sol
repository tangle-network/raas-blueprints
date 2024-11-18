// SPDX-License-Identifier: UNLICENSE
pragma solidity >=0.8.13;

import "contracts/lib/tnt-core/src/BlueprintServiceManagerBase.sol";

contract OrbitRaaSBlueprint is BlueprintServiceManagerBase {
    struct RollupConfig {
        uint64 chainId;
        address owner;
        address[] validators;
        address[] batchPosters;
        address nativeToken;
        bool dataAvailabilityCommittee;
        bool isCustomFeeToken;
        address customFeeToken;
        bool setupTokenBridge;
        bool nativeTokenIsERC20;
    }

    // Mapping from serviceId to RollupConfig
    mapping(uint64 => RollupConfig) public rollupConfigs;
    // Mapping from operator public key to address
    mapping(address => bool) public registeredOperators;

    function onRegister(bytes calldata operator, bytes calldata _registrationInputs)
        public
        payable
        override
        onlyFromRootChain
    {
        address operatorAddr = operatorAddressFromPublicKey(operator);
        registeredOperators[operatorAddr] = true;
    }

    function onRequest(uint64 serviceId, bytes[] calldata operators, bytes calldata requestInputs)
        public
        payable
        override
        onlyFromRootChain
    {
        // Decode rollup configuration from requestInputs
        RollupConfig memory config = abi.decode(requestInputs, (RollupConfig));
        
        // Verify all operators are registered
        for (uint i = 0; i < operators.length; i++) {
            address operatorAddr = operatorAddressFromPublicKey(operators[i]);
            require(registeredOperators[operatorAddr], "Operator not registered");
        }

        // Store configuration
        rollupConfigs[serviceId] = config;
    }
    
    function operatorAddressFromPublicKey(bytes calldata publicKey) internal pure returns (address operator) {
        return address(uint160(uint256(keccak256(publicKey))));
    }

    function getRollupConfig(uint64 serviceId) public view returns (
        uint64 chainId,
        address owner,
        address[] memory validators,
        address[] memory batchPosters,
        address nativeToken,
        bool dataAvailabilityCommittee,
        bool isCustomFeeToken,
        address customFeeToken,
        bool setupTokenBridge,
        bool nativeTokenIsERC20
    ) {
        RollupConfig storage config = rollupConfigs[serviceId];
        return (
            config.chainId,
            config.owner,
            config.validators,
            config.batchPosters,
            config.nativeToken,
            config.dataAvailabilityCommittee,
            config.isCustomFeeToken,
            config.customFeeToken,
            config.setupTokenBridge,
            config.nativeTokenIsERC20
        );
    }
}