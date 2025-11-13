/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://polydogs.vercel.app',
  generateRobotsTxt: true,
  exclude: ['/api/*'],
}
