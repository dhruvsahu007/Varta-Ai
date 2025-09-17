import { db } from "./db";
import { users, channels, channelMembers, messages, aiSuggestions, meetingNotes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  try {
    // Get or create users
    let alice = await db.select().from(users).where(eq(users.username, "alice")).limit(1);
    let bob = await db.select().from(users).where(eq(users.username, "bob")).limit(1);
    let charlie = await db.select().from(users).where(eq(users.username, "charlie")).limit(1);

    if (alice.length === 0) {
      alice = await db.insert(users).values({
        username: "alice",
        password: await hashPassword("password123"),
        email: "alice@example.com",
        displayName: "Alice Smith",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
        status: "available",
        title: "Product Manager"
      }).returning();
    }

    if (bob.length === 0) {
      bob = await db.insert(users).values({
        username: "bob",
        password: await hashPassword("password123"),
        email: "bob@example.com",
        displayName: "Bob Johnson",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
        status: "available",
        title: "Software Engineer"
      }).returning();
    }

    if (charlie.length === 0) {
      charlie = await db.insert(users).values({
        username: "charlie",
        password: await hashPassword("password123"),
        email: "charlie@example.com",
        displayName: "Charlie Brown",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie",
        status: "available",
        title: "UX Designer"
      }).returning();
    }

    // Check if channels already exist, if not create them
    let general = await db.select().from(channels).where(eq(channels.name, "general")).limit(1);
    let random = await db.select().from(channels).where(eq(channels.name, "random")).limit(1);
    let announcements = await db.select().from(channels).where(eq(channels.name, "announcements")).limit(1);

    if (general.length === 0) {
      general = await db.insert(channels).values({
        name: "general",
        description: "General discussion channel",
        isPrivate: false,
        createdBy: alice[0].id
      }).returning();
    }

    if (random.length === 0) {
      random = await db.insert(channels).values({
        name: "random",
        description: "Random discussions and fun stuff",
        isPrivate: false,
        createdBy: bob[0].id
      }).returning();
    }

    if (announcements.length === 0) {
      announcements = await db.insert(channels).values({
        name: "announcements",
        description: "Important announcements and updates",
        isPrivate: false,
        createdBy: alice[0].id
      }).returning();
    }

    // Add users to channels
    await Promise.all([
      // Add all users to general channel
      db.insert(channelMembers).values([
        { channelId: general[0].id, userId: alice[0].id },
        { channelId: general[0].id, userId: bob[0].id },
        { channelId: general[0].id, userId: charlie[0].id }
      ]),
      // Add all users to random channel
      db.insert(channelMembers).values([
        { channelId: random[0].id, userId: alice[0].id },
        { channelId: random[0].id, userId: bob[0].id },
        { channelId: random[0].id, userId: charlie[0].id }
      ]),
      // Add all users to announcements channel
      db.insert(channelMembers).values([
        { channelId: announcements[0].id, userId: alice[0].id },
        { channelId: announcements[0].id, userId: bob[0].id },
        { channelId: announcements[0].id, userId: charlie[0].id }
      ])
    ]);

    // Create some messages with rich organizational content
    const messages_to_insert = [
      // General channel messages
      {
        content: "Welcome to our Slack AI Companion! 👋 This workspace is designed to help our team collaborate more effectively.",
        authorId: alice[0].id,
        channelId: general[0].id,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
      {
        content: "Hey team! The Atlas Project kickoff meeting is scheduled for next Tuesday at 2:00 PM. We'll be discussing the new AI integration features and timeline.",
        authorId: bob[0].id,
        channelId: general[0].id,
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      },
      {
        content: "Atlas Project update: We've completed the user research phase. Key findings: 78% of users want better search functionality, 65% need improved collaboration tools.",
        authorId: charlie[0].id,
        channelId: general[0].id,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
      {
        content: "The Atlas Project timeline has been updated. Sprint 1 ends Friday, Sprint 2 starts Monday. Please update your tasks in the project board.",
        authorId: alice[0].id,
        channelId: general[0].id,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
      {
        content: "Great work on the Atlas Project demo today! The stakeholders were impressed with our progress. Next milestone: beta release by end of month.",
        authorId: bob[0].id,
        channelId: general[0].id,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      
      // Announcements channel
      {
        content: "🚨 IMPORTANT: All hands meeting tomorrow (Thursday) at 10:00 AM. We'll discuss Q4 goals, budget planning, and the Atlas Project roadmap.",
        authorId: alice[0].id,
        channelId: announcements[0].id,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        content: "New company policy: Remote work guidelines updated. Please review the documentation in the shared drive. Questions welcome in #general.",
        authorId: alice[0].id,
        channelId: announcements[0].id,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        content: "Atlas Project goes live next week! 🎉 Thanks to everyone who contributed. Special thanks to Bob for the backend architecture and Charlie for the amazing UX design.",
        authorId: alice[0].id,
        channelId: announcements[0].id,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      },
      
      // Random channel
      {
        content: "Anyone up for a game of virtual chess? ♟️ I'm taking a break from coding the Atlas Project features.",
        authorId: bob[0].id,
        channelId: random[0].id,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      },
      {
        content: "Coffee chat at 3 PM in the break room! Let's discuss non-work stuff for once 😄",
        authorId: charlie[0].id,
        channelId: random[0].id,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      },
      {
        content: "Pro tip: The new Atlas Project dashboard has a dark mode! Toggle it in settings → appearance. Your eyes will thank you during late coding sessions.",
        authorId: bob[0].id,
        channelId: random[0].id,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }
    ];

    const insertedMessages = [];
    for (const msg of messages_to_insert) {
      const inserted = await db.insert(messages).values({
        ...msg,
        updatedAt: new Date()
      }).returning();
      insertedMessages.push(inserted[0]);
    }

    const [welcomeMsg, atlasKickoffMsg, ...otherMessages] = insertedMessages;

    // Create some AI suggestions
    await db.insert(aiSuggestions).values([
      {
        messageId: welcomeMsg.id,
        suggestedReply: "Thanks for the warm welcome! Excited to be here! 🎉",
        confidence: 85,
        reasoning: "Friendly and enthusiastic response to welcome message"
      },
      {
        messageId: atlasKickoffMsg.id,
        suggestedReply: "Great! I'll make sure to prepare the technical requirements document beforehand.",
        confidence: 90,
        reasoning: "Professional response showing preparation for the Atlas Project meeting"
      }
    ]);

    // Create a meeting note for Atlas Project
    await db.insert(meetingNotes).values({
      title: "Atlas Project - Weekly Sync",
      content: "Key Discussion Points:\n1. User research findings completed - 78% want better search\n2. Sprint 1 timeline updated - ends Friday\n3. Beta release target: end of month\n4. Stakeholder demo feedback: very positive\n5. Next: Sprint 2 planning\n\nAction Items:\n- Update project board tasks (All)\n- Prepare beta release plan (Alice)\n- Continue UI improvements (Charlie)\n- Backend optimization (Bob)",
      channelId: general[0].id,
      startMessageId: welcomeMsg.id,
      endMessageId: insertedMessages[4].id, // Great work on demo message
      generatedBy: alice[0].id
    });

    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

seed();
