import { EmbedBuilder, WebhookClient } from "discord.js";
import { Field } from "../types/interface";
import { Post } from "@prisma/client";

const webhookClient = new WebhookClient({
  url: process.env.WEBHOOK_URL!,
});

interface PickupData {
  title: string;
  fields: Field[];
}
export function sendPickupDataToDiscord(pickupData: PickupData) {
  const embed = new EmbedBuilder();
  embed.setTitle(pickupData.title);
  for (let field of pickupData.fields) {
    embed.addFields({
      name: `${field.name}`,
      value: `${field.value
        .split(",")
        .map((item) => `- ${item}\n`)
        .join("")}`,
    });
  }
  embed.setDescription(
    "```[ 서클보상 S / 팀레5유지 / 챔미A결3위 / 월정액 / 말오스 플레3 ]```"
  );
  embed.setColor("Green");
  embed.setTimestamp();
  webhookClient.send({ embeds: [embed] });
}

export function sendPostToDiscord(post: Post) {
  const embed = new EmbedBuilder();
  embed.setTitle(post.title);
  embed.setImage(post.image);
  embed.setDescription(post.description);
  embed.setColor("Green");
  embed.setTimestamp();
  webhookClient.send({ embeds: [embed] });
}
