const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, operator] = await hre.ethers.getSigners();

  console.log("Deploying SecureEscrow...");
  console.log("  Deployer  :", deployer.address);
  console.log("  Operator  :", operator.address);

  const Factory = await hre.ethers.getContractFactory("SecureEscrow");
  const contract = await Factory.deploy(operator.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("  Contract  :", address);

  // ── Write deployment info to backend config ───────────────────────────────
  const deployInfo = {
    contractAddress: address,
    deployerAddress: deployer.address,
    operatorAddress: operator.address,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
  };

  const backendDir = path.join(__dirname, "..", "backend", "config");
  fs.mkdirSync(backendDir, { recursive: true });

  fs.writeFileSync(
    path.join(backendDir, "deployment.json"),
    JSON.stringify(deployInfo, null, 2)
  );
  console.log("  Deployment info written to backend/config/deployment.json");

  // ── Copy ABI to backend ───────────────────────────────────────────────────
  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", "SecureEscrow.sol", "SecureEscrow.json"
  );

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    fs.writeFileSync(
      path.join(backendDir, "SecureEscrow.abi.json"),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log("  ABI written to backend/config/SecureEscrow.abi.json");
  }

  console.log("\nDeployment complete.");
  console.log("\nUpdate your backend/.env with:");
  console.log(`  CONTRACT_ADDRESS=${address}`);
  console.log(`  OPERATOR_ADDRESS=${operator.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
