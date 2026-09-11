// Start from the seated pose; replace every arm axis so its lap-resting twist
// cannot carry into the raised hand. Keep the elbow out and the palm by the temple.
export function raiseClassroomHand(avatar) {
  const b = avatar.boneMap;
  b.RightUpperArm.rotation.set(-.12, 0, -.5);
  b.RightLowerArm.rotation.set(0, 0, -1.05);
  b.RightHand.rotation.set(0, .12, -.05);
  b.Head.rotation.x = -.15;
}
