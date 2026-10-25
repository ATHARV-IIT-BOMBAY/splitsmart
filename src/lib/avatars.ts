import { createAvatar, type Style } from '@dicebear/core'
import * as adventurer from '@dicebear/adventurer'
import * as bottts from '@dicebear/bottts'
import * as funEmoji from '@dicebear/fun-emoji'
import * as lorelei from '@dicebear/lorelei'
import * as thumbs from '@dicebear/thumbs'
import type { AvatarStyle } from '../core/types'

/*
 * Illustrated avatars drawn on the device by DiceBear (no network).
 * This module is big, so it's only ever loaded with import().
 */

export const AVATAR_STYLES: Record<AvatarStyle, Style<object>> = { adventurer, bottts, funEmoji, lorelei, thumbs }

const cache = new Map<string, string>()

export function avatarUri(style: AvatarStyle, seed: string): string {
  const key = `${style}:${seed}`
  let uri = cache.get(key)
  if (!uri) {
    uri = createAvatar(AVATAR_STYLES[style], { seed }).toDataUri()
    cache.set(key, uri)
  }
  return uri
}
