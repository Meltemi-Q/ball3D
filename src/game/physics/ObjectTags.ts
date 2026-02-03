export type ObjectTag =
  | 'ball'
  | 'floor'
  | 'wall'
  | 'bumper'
  | 'target'
  | 'dropTarget'
  | 'spinner'
  | 'sling'
  | 'kickout'
  | 'drain'
  | 'lane'
  | 'flipper'

export type ColliderMeta = {
  tag: ObjectTag
  id?: string
  score?: number
}
