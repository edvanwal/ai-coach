import { prisma } from "./db";

export async function getOrCreateProfileId(): Promise<string> {
  let profile = await prisma.profile.findFirst();
  if (!profile) {
    profile = await prisma.profile.create({
      data: { adhdContext: "", situatie: "", doelen: "" },
    });
  }
  return profile.id;
}
