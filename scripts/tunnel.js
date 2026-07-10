const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

// Keep process alive
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

(async () => {
  try {
    console.log("Starting localtunnel on port 3000...");
    const tunnel = await localtunnel({ port: 3000 });
    console.log("Tunnel is active!");
    console.log("URL:", tunnel.url);
    
    // Write URL to a file
    const urlFilePath = path.join(__dirname, '..', 'tunnel_url.txt');
    fs.writeFileSync(urlFilePath, tunnel.url, 'utf8');
    console.log("Wrote URL to:", urlFilePath);

    tunnel.on('close', () => {
      console.log("tunnel closed");
      clearInterval(keepAlive);
      if (fs.existsSync(urlFilePath)) {
        fs.unlinkSync(urlFilePath);
      }
      process.exit(0);
    });
    
    tunnel.on('error', (err) => {
      console.error("Tunnel error:", err);
    });
  } catch (err) {
    console.error("Error creating tunnel:", err);
    clearInterval(keepAlive);
    process.exit(1);
  }
})();
