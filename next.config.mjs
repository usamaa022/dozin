import os from 'os';

// Automatically find all local network IPs for your computer
const interfaces = os.networkInterfaces();
const localIps = [];

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    // Grab all IPv4 addresses that are not localhost (127.0.0.1)
    if (iface.family === 'IPv4' && !iface.internal) {
      localIps.push(iface.address);
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Feed the detected IPs directly into Next.js security settings
  allowedDevOrigins: localIps,
};

export default nextConfig;