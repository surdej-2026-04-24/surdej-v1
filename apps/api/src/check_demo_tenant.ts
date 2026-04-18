
import { prisma } from './db.js';

async function main() {
    const domain = await prisma.tenantDomain.findFirst({
        where: { domain: 'happymates.dk' },
        include: {
            tenant: {
                include: {
                    authProviders: true,
                    domains: true
                }
            }
        }
    });

    if (!domain) {
        console.log('No tenant domain found for happymates.dk');

        const user = await prisma.user.findUnique({ where: { email: 'niels@happymates.dk' } });
        if (user) {
            console.log('User found:', user.email, 'Role:', user.role);
            // Check memberships
            const memberships = await prisma.userTenant.findMany({
                where: { userId: user.id },
                include: { tenant: { include: { authProviders: true } } }
            });
            console.log('User Memberships:', JSON.stringify(memberships, null, 2));
        } else {
            console.log('User niels@happymates.dk NOT found.');
        }
        return;
    }

    console.log('Tenant:', domain.tenant.name);
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
