export type ObjectTag =
  | 'ball'
  | 'floor'
  | 'wall'
  | 'bumper'
  | 'target'
  | 'drain'
  | 'lane'
  | 'flipper'

export type ColliderMeta = {
  tag: ObjectTag
  id?: string
  score?: number
}

