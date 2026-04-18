
import { prisma } from './src/db.js';

async function main() {
    const domain = await prisma.tenantDomain.findFirst({
        where: { domain: 'happymates.dk' },
        include: {
            tenant: {
                include: {
                    authProviders: true
                }
            }
        }
    });

    if (!domain) {
        console.log('No domain found for happymates.dk');

        // Check for user
        const user = await prisma.user.findUnique({ where: { email: 'niels@happymates.dk' } });
        console.log('User:', user);

        return;
    }

    console.log('Domain Tenant:', domain.tenant.name);
    console.log('Auth Providers:', JSON.stringify(domain.tenant.authProviders, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
