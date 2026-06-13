/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow Cloudinary-delivered media once configured.
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

export default nextConfig;
