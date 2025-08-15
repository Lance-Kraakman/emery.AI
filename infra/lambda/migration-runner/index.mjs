import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { execSync } from "child_process";

const secretsManager = new SecretsManagerClient();

async function getDatabaseUrl() {
  const secretArn = process.env.DB_SECRET_ARN;
  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secretDict = JSON.parse(secret.SecretString);

  const { username, password, host, port, dbname } = secretDict;
  return `postgresql://${username}:${password}@${host}:${port}/${dbname}`;
}

async function runMigrations() {
  const databaseUrl = await getDatabaseUrl();
  const command = "pnpm drizzle-kit migrate";
  
  try {
    const output = execSync(command, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    console.log("Migration successful:", output);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

export async function handler(event, context) {
  console.log("## EVENT");
  console.log(JSON.stringify(event));

  const requestType = event.RequestType;
  if (requestType === "Create" || requestType === "Update") {
    await runMigrations();
  }

  return { Status: "SUCCESS" };
}
