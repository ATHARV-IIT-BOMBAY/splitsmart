import { useMemo, useState } from 'react'
import { button } from '../../components/styles'
import { Avatar, Sheet } from '../../components/ui'
import { MEMBER_COLORS } from '../../core/members'
import type { AvatarStyle, Member } from '../../core/types'
import { AVATAR_STYLES, avatarUri } from '../../lib/avatars'
import { useGroups } from '../../store/groups'

// Names used as seeds: each seed always draws the same character
const SEEDS = ['Mia', 'Leo', 'Zoe', 'Kai', 'Ava', 'Rio', 'Ivy', 'Max', 'Nia', 'Sam', 'Tia', 'Dev']

const STYLE_LABELS: Record<AvatarStyle, string> = {
  adventurer: 'Adventurer',
  bottts: 'Robots',
  funEmoji: 'Fun emoji',
  lorelei: 'Lorelei',
  thumbs: 'Thumbs',
}

/** Pick a character and a colour for a member. Written by Nimitt; loaded only when opened. */
export default function AvatarPicker({ groupId, member, onClose }: { groupId: string; member: Member; onClose: () => void }) {
  const updateMember = useGroups((s) => s.updateMember)
  const [color, setColor] = useState(member.color)
  const [avatar, setAvatar] = useState(member.avatar)
  const [style, setStyle] = useState<AvatarStyle>(member.avatar?.style ?? 'adventurer')

  const options = useMemo(() => SEEDS.map((seed) => ({ seed, uri: avatarUri(style, seed) })), [style])

  function save() {
    updateMember(groupId, member.id, { color, avatar })
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={`${member.name}’s look`}>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto text-ink">
        <div className="flex justify-center" aria-hidden="true">
          <Avatar member={{ ...member, color, avatar }} size={72} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Characters</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(AVATAR_STYLES) as AvatarStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={style === s}
                onClick={() => setStyle(s)}
                className={`rounded-full border-2 border-edge px-3 py-1 text-sm font-semibold ${
                  style === s ? 'bg-pop text-[#1c1b19]' : 'bg-paper text-ink'
                }`}
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {options.map(({ seed, uri }) => {
              const selected = avatar?.style === style && avatar.seed === seed
              return (
                <button
                  key={seed}
                  type="button"
                  aria-label={`Character ${seed}`}
                  aria-pressed={selected}
                  onClick={() => setAvatar({ style, seed })}
                  style={{ backgroundColor: color }}
                  className={`aspect-square overflow-hidden rounded-full border-2 border-edge ${
                    selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''
                  }`}
                >
                  <img src={uri} alt="" className="block h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Colour</p>
          <div className="flex flex-wrap gap-2">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-9 w-9 rounded-full border-2 border-edge ${
                  color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <button type="button" className={`${button.primary} w-full`} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  )
}
