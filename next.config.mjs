import os from 'os';

const interfaces = os.networkInterfaces();
const localIps = [];

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIps.push(iface.address);
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: localIps,
  // ADD THIS BLOCK TO STOP VERCEL FROM CRASHING
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;