import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const hashedPassword = await bcrypt.hash("lovetyche!", 12);

    await prisma.user.upsert({
        where: { email: "tyche@tyche.ooo" },
        update: {},
        create: {
            email: "tyche@tyche.ooo",
            name: "Admin User",
            password: hashedPassword,
            role: "admin",
        },
    });

    console.log("Database seeded successfully");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
