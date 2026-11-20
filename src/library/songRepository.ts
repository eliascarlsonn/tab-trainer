import { collection } from "@/lib/storage";
import type { Song } from "./song";

export const songRepository = collection<Song>("songs");
