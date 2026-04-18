import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const source = await prisma.skin.findUnique({ where: { id: 'skin-default' } });
  if (!source) {
    console.log("No source found");
    return;
  }
  try {
        const clone = await prisma.skin.create({
            data: {
                name: source.name + ' (Copy)',
                description: source.description,
                branding: source.branding,
                sidebar: source.sidebar,
                activityBar: source.activityBar === null ? undefined : source.activityBar,
                theme: source.theme === null ? undefined : source.theme,
                homepageConfig: source.homepageConfig === null ? undefined : source.homepageConfig,
                isBuiltIn: false,
            },
        });
        console.log("SUCCESS:", clone.id);
  } catch(e) {
    console.error("ERROR:", e);
  }
}
main().finally(() => prisma.$disconnect());
