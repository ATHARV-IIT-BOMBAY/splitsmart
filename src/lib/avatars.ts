import { createAvatar, type Style } from '@dicebear/core'
import { adventurer, bottts, funEmoji, lorelei, thumbs } from '@dicebear/collection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AVATAR_STYLES: Record<string, Style<any>> = {
  adventurer,
  bottts,
  funEmoji,
  lorelei,
  thumbs,
}

export type AvatarStyle = 'adventurer' | 'bottts' | 'funEmoji' | 'lorelei' | 'thumbs'

export const avatarUri = (style: AvatarStyle, seed: string) =>
  createAvatar(AVATAR_STYLES[style], { seed }).toDataUri()