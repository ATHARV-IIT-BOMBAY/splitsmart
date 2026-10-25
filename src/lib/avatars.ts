import { createAvatar } from '@dicebear/core'
import { adventurer, bottts, funEmoji, lorelei, thumbs } from '@dicebear/collection'

export const AVATAR_STYLES = { adventurer, bottts, funEmoji, lorelei, thumbs }
export type AvatarStyle = keyof typeof AVATAR_STYLES

export const avatarUri = (style: AvatarStyle, seed: string) =>
  createAvatar(AVATAR_STYLES[style], { seed }).toDataUri()