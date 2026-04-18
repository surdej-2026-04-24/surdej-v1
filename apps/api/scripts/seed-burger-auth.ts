
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for "Demo - Burger Restaurant"...');

    // Find the tenant
    const tenant = await prisma.tenant.findFirst({
        where: {
            OR: [
                { name: { contains: 'Burger', mode: 'insensitive' } },
                { slug: { contains: 'burger', mode: 'insensitive' } }
            ]
        }
    });

    if (!tenant) {
        console.error('Tenant not found!');
        process.exit(1);
    }

    console.log(`Found tenant: ${tenant.name} (${tenant.id})`);

    // 1. Add Domain
    const domainName = 'happymates.dk';
    const domain = await prisma.tenantDomain.upsert({
        where: { domain: domainName },
        update: {
            tenantId: tenant.id,
            verified: true,
            isPrimary: true
        },
        create: {
            domain: domainName,
            tenantId: tenant.id,
            verified: true,
            isPrimary: true
        }
    });
    console.log(`Domain ${domainName} configured.`);

    // 2. Add Auth Provider (Microsoft)
    const clientId = '0323d177-f9bd-43e7-937c-57cabad8b932';
    const tenantId = '8bfad545-8650-4872-a917-20c9720b906b'; // Directory ID
    const objectId = '8b0b81eb-c549-441f-bc51-88f8f7754d8b'; // App Object ID

    await prisma.authProvider.upsert({
        where: {
            tenantId_type: {
                tenantId: tenant.id,
                type: 'microsoft' // or 'entra' depending on what I used in schema/enum
            }
        },
        update: {
            isEnabled: true,
            clientId: clientId,
            clientSecret: 'PLACEHOLDER_SECRET', // User didn't provide this, maybe standard or manual entry later
            metadata: {
                tenantId: tenantId,
                objectId: objectId,
            }
        },
        create: {
            tenantId: tenant.id,
            type: 'microsoft',
            connectionId: `conn_${Math.random().toString(36).substring(7)}`, // internal ID
            isEnabled: true,
            clientId: clientId,
            clientSecret: 'PLACEHOLDER_SECRET',
            metadata: {
                tenantId: tenantId,
                objectId: objectId,
            }
        }
    });

    console.log('Auth Provider configured.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
