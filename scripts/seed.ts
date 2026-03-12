import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const hashedPassword = await bcrypt.hash("hellotyche!", 12);

    await prisma.user.upsert({
        where: { email: "cumtyche@gmail.com" },
        update: {},
        create: {
            email: "cumtyche@gmail.com",
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
