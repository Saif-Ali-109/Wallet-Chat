import { ethers } from "hardhat";

async function main() {
  const ChatRegistry = await ethers.getContractFactory("ChatRegistry");
  const chatRegistry = await ChatRegistry.deploy();

  await chatRegistry.waitForDeployment();

  console.log(`ChatRegistry deployed to: ${await chatRegistry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
