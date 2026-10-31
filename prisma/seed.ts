import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Seed Dining Tables 1 to 10
  console.log("Seeding dining tables 1 to 10...");
  for (let i = 1; i <= 10; i++) {
    await prisma.diningTable.upsert({
      where: { number: i },
      update: {},
      create: {
        number: i,
      },
    });
  }

  // 2. Seed 35 Realistic Menu Items
  console.log("Seeding 35 menu items...");
  const menuItems = [
    // --- Starters (7) ---
    {
      name: "Paneer Tikka",
      description: "Fresh cottage cheese cubes marinated in spiced yogurt and char-grilled in the tandoor.",
      price: 380,
      category: "starter",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 2,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Crispy Corn Pepper Salt",
      description: "Golden fried sweet corn kernels tossed with bell peppers, spring onion, and cracked black pepper.",
      price: 290,
      category: "starter",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 1,
      cuisine: "Indo-Chinese",
      isAvailable: true,
    },
    {
      name: "Chicken Malai Tikka",
      description: "Tender boneless chicken steeped in a cream, hung curd, cashew, and cardamom marinade.",
      price: 460,
      category: "starter",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 1,
      cuisine: "Mughlai",
      isAvailable: true,
    },
    {
      name: "Mutton Seekh Kebab",
      description: "Finely minced spiced lamb infused with fresh mint and coriander, flame-grilled on skewers.",
      price: 580,
      category: "starter",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 3,
      cuisine: "Mughlai",
      isAvailable: true,
    },
    {
      name: "Tandoori Soya Chaap",
      description: "Protein-rich soya chops marinated in a robust red tandoori spice blend, roasted to perfection.",
      price: 340,
      category: "starter",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 2,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Prawns Butter Garlic",
      description: "Juicy bay prawns sauteed in garlic-infused golden butter with crushed white pepper and herbs.",
      price: 620,
      category: "starter",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 1,
      cuisine: "Coastal Indian",
      isAvailable: true,
    },
    {
      name: "Dahi ke Kebab",
      description: "Crispy outer crust with a velvety hung curd and cottage cheese center, delicately spiced.",
      price: 320,
      category: "starter",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },

    // --- Mains (11) ---
    {
      name: "Butter Chicken",
      description: "Tandoori chicken pieces simmered in a silky tomato, cashew, butter, and dried fenugreek gravy.",
      price: 560,
      category: "main",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 1,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Paneer Butter Masala",
      description: "Soft paneer cubes simmered in a mildly sweet and spiced rich creamy tomato-butter curry.",
      price: 440,
      category: "main",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 1,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Dal Makhani",
      description: "Whole black urad lentils and kidney beans slow-simmered overnight with churned butter and cream.",
      price: 380,
      category: "main",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 1,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Chana Masala",
      description: "Tender chickpeas simmered in an aromatic Punjabi onion-tomato gravy with dry roasted pomegranate seeds.",
      price: 320,
      category: "main",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 2,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Mutton Rogan Josh",
      description: "Kashmiri-style braised lamb shank curry cooked with fennel seed powder, Kashmiri chillies, and warm spices.",
      price: 680,
      category: "main",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 3,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Hyderabadi Chicken Dum Biryani",
      description: "Long-grain basmati rice layered with spiced marinated chicken, saffron milk, fried onions, and mint.",
      price: 490,
      category: "main",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 2,
      cuisine: "Mughlai",
      isAvailable: true,
    },
    {
      name: "Vegetable Dum Biryani",
      description: "Fragrant saffron basmati rice layered with garden vegetables, aromatic spices, and brown shallots.",
      price: 390,
      category: "main",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 2,
      cuisine: "Mughlai",
      isAvailable: true,
    },
    {
      name: "Kadhai Paneer",
      description: "Paneer cubes tossed with crisp bell peppers, onions, and freshly ground coriander-red chilli spices.",
      price: 450,
      category: "main",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 3,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Kerala Fish Curry",
      description: "Fresh sear fish steaks cooked in a coconut milk reduction with cocum, shallots, and fragrant curry leaves.",
      price: 640,
      category: "main",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 2,
      cuisine: "Coastal Indian",
      isAvailable: true,
    },
    {
      name: "Vegetable Thai Green Curry with Rice",
      description: "Broccoli, zucchini, and baby corn simmered in a coconut green curry paste, served with steamed jasmine rice.",
      price: 480,
      category: "main",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 2,
      cuisine: "Asian",
      isAvailable: true,
    },
    {
      name: "Chef's Royal Mughlai Meat Platter",
      description: "Grand sharing platter featuring mutton rogan josh, chicken seekh, dal makhani, saffron pulao, and naan.",
      price: 1190,
      category: "main",
      dietTags: JSON.stringify(["non-veg"]),
      spiceLevel: 2,
      cuisine: "Mughlai",
      isAvailable: true,
    },

    // --- Sides (6) ---
    {
      name: "Assorted Gourmet Naan Basket",
      description: "Warm basket containing butter naan, garlic coriander naan, and flaky laccha paratha with house dips.",
      price: 240,
      category: "side",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Garlic & Herb Naan",
      description: "Clay-oven leavened flatbread brushed with crushed roasted garlic, cilantro, and warm herb butter.",
      price: 210,
      category: "side",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Jeera Basmati Pulao",
      description: "Fragrant aged basmati rice tempered with golden roasted cumin seeds and pure desi ghee.",
      price: 220,
      category: "side",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Steamed Jasmine Rice",
      description: "Delicately fragrant steamed jasmine rice bowl, perfect accompaniment for rich curries.",
      price: 200,
      category: "side",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 0,
      cuisine: "Asian",
      isAvailable: true,
    },
    {
      name: "Burani Garlic Raita & Masala Papad",
      description: "Thick spiced yogurt whipped with roasted garlic and cumin, served with crisp roasted masala papad.",
      price: 210,
      category: "side",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 1,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Peri-Peri Masala Potato Wedges",
      description: "Crispy oven-roasted potato wedges tossed in a tangy peri-peri spice blend with lemon garlic mayo.",
      price: 250,
      category: "side",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 2,
      cuisine: "Continental",
      isAvailable: true,
    },

    // --- Desserts (5) ---
    {
      name: "Gulab Jamun with Rabri",
      description: "Warm khoya dumplings steeped in saffron-cardamom syrup, served atop chilled slow-cooked rabri.",
      price: 240,
      category: "dessert",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Kesari Rasmalai",
      description: "Tender flattened chenna patties soaked in thick clotted milk infused with saffron, cardamom, and pistachios.",
      price: 260,
      category: "dessert",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Sizzling Dark Chocolate Brownie",
      description: "Warm Belgian chocolate brownie served on a sizzling hot plate with vanilla bean ice cream and hot fudge.",
      price: 320,
      category: "dessert",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "Continental",
      isAvailable: true,
    },
    {
      name: "Shahi Tukda",
      description: "Crispy golden ghee-fried bread steeped in cardamom syrup, topped with rich rabri and slivered almonds.",
      price: 280,
      category: "dessert",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "Mughlai",
      isAvailable: true,
    },
    {
      name: "Alphonso Mango Kulfi",
      description: "Traditional dense Indian ice cream prepared from reduced milk and Ratnagiri Alphonso mango pulp.",
      price: 250,
      category: "dessert",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },

    // --- Drinks (6) ---
    {
      name: "Amritsari Sweet Lassi",
      description: "Classic hand-churned yogurt drink sweetened with cane sugar, topped with thick clotted cream and pistachios.",
      price: 200,
      category: "drink",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 0,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Roasted Cumin Spiced Chaas",
      description: "Refreshing salted buttermilk churned with roasted cumin powder, black salt, fresh mint, and ginger.",
      price: 200,
      category: "drink",
      dietTags: JSON.stringify(["veg"]),
      spiceLevel: 1,
      cuisine: "North Indian",
      isAvailable: true,
    },
    {
      name: "Fresh Mango Basil Cooler",
      description: "Chilled Alphonso mango puree muddled with sweet basil leaves, fresh lime, and club soda.",
      price: 240,
      category: "drink",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 0,
      cuisine: "Continental",
      isAvailable: true,
    },
    {
      name: "Fresh Lime Soda (Sweet & Salted)",
      description: "Crisp sparkling water with hand-pressed key lime juice, cane syrup, and Himalayan black salt.",
      price: 210,
      category: "drink",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 0,
      cuisine: "Continental",
      isAvailable: true,
    },
    {
      name: "Virgin Mint Mojito",
      description: "Fresh garden mint leaves and lime wedges crushed with raw sugar, topped with chilled fizzy soda.",
      price: 260,
      category: "drink",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 0,
      cuisine: "Continental",
      isAvailable: true,
    },
    {
      name: "Masala Chai Infused Iced Tea",
      description: "Cold-brewed spiced Assam black tea with notes of cinnamon, clove, lemongrass, and fresh lemon.",
      price: 230,
      category: "drink",
      dietTags: JSON.stringify(["vegan", "veg"]),
      spiceLevel: 1,
      cuisine: "Indo-Fusion",
      isAvailable: true,
    },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name },
    });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.menuItem.create({
        data: item,
      });
    }
  }

  const tableCount = await prisma.diningTable.count();
  const itemCount = await prisma.menuItem.count();
  console.log(`Seeding complete: ${tableCount} tables and ${itemCount} menu items in database.`);
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
