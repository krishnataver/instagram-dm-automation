const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const urlFilePath = path.join(__dirname, '..', 'tunnel_url.txt');

console.log("Starting Pinggy tunnel via SSH on port 443...");
try {
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-T',
    '-p', '443',
    '-R0:localhost:3000',
    'free.pinggy.io'
  ]);

  ssh.on('error', (err) => {
    console.error("Failed to start SSH process:", err);
  });

  ssh.stdout.on('data', (data) => {
    const output = data.toString();
    console.log("SSH stdout:", output);
    const match = output.match(/https:\/\/[a-z0-9-]+\.free\.pinggy\.link/i);
    if (match) {
      const url = match[0];
      console.log("Tunnel is active! URL:", url);
      fs.writeFileSync(urlFilePath, url, 'utf8');
    }
  });

  ssh.stderr.on('data', (data) => {
    console.error("SSH stderr:", data.toString());
  });

  ssh.on('close', (code) => {
    console.log(`SSH tunnel closed with code ${code}`);
    if (fs.existsSync(urlFilePath)) {
      fs.unlinkSync(urlFilePath);
    }
  });
} catch (e) {
  console.error("Try-catch error spawning SSH:", e);
}
