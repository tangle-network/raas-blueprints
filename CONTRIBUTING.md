# Contributing to RaaS Blueprints

We appreciate your interest in contributing to the RaaS Blueprints! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Adding a New Blueprint

1. Create a new directory under `blueprints/` with your blueprint name
2. Include the following structure:
   ```
   blueprints/your-blueprint/
   ├── src/
   │   ├── lib.rs
   │   ├── main.rs
   │   └── jobs/
   │       └── mod.rs
   ├── scripts/
   ├── contracts/
   └── README.md
   ```
3. Implement the required traits from the Tangle SDK
4. Add comprehensive tests
5. Document your blueprint thoroughly

### Modifying Existing Blueprints

1. Create an issue describing the proposed changes
2. Fork the repository and create a feature branch
3. Make your changes following our coding standards
4. Submit a pull request with a clear description

## Development Guidelines

### Rust Code
- Follow Rust's official style guidelines
- Use meaningful variable and function names
- Document public APIs with rustdoc
- Handle errors appropriately using Result types
- Write unit tests for all public functions

### Smart Contracts
- Follow Solidity style guide
- Include comprehensive NatSpec comments
- Write thorough test coverage
- Use latest stable Solidity version
- Implement proper access control

### TypeScript Scripts
- Use TypeScript for all scripts
- Follow ESLint configuration
- Include proper error handling
- Use async/await for asynchronous operations
- Document function parameters and return types

## Testing

### Required Tests
- Unit tests for all Rust code
- Integration tests for job handlers
- Smart contract tests using Foundry
- End-to-end tests for complete workflows

### Running Tests
**Rust tests**
```bash
cargo test
```
**Smart contract tests**
```bash
forge test
```
**TypeScript tests**
```bash
yarn test
```

## Pull Request Process

1. Update documentation reflecting any changes
2. Add tests for new functionality
3. Ensure CI passes all checks
4. Request review from maintainers
5. Address review feedback promptly

## Release Process

1. Version numbers follow SemVer
2. Document all changes in CHANGELOG.md
3. Tag releases appropriately
4. Update documentation as needed

## Getting Help

- Open an issue for bugs or feature requests
- Join our Discord for community discussions
- Check existing documentation and issues first

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project (MIT/Apache-2.0 dual license).