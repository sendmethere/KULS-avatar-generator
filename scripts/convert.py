"""Convert the web avatar GLB into an editable Blender scene or Unity FBX."""
import bpy, sys, os, json
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
source, target = args[:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
rigs = [o for o in scene.objects if o.type == 'ARMATURE']
# glTF's importer adds hidden icosphere bone-display helpers; exclude them from assets.
for rig in rigs:
    for bone in rig.pose.bones: bone.custom_shape = None
helper_collection = bpy.data.collections.get('glTF_not_exported')
if helper_collection:
    for obj in list(helper_collection.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(helper_collection)
for rig in rigs:
    rig.name = 'AvatarRig'
    rig.show_in_front = True
    rig.data.display_type = 'OCTAHEDRAL'
    rig['description'] = 'T-pose rest rig. Pose Mode to animate. Facial expressions are mesh Shape Keys.'
for obj in scene.objects:
    if obj.type == 'MESH':
        for poly in obj.data.polygons: poly.use_smooth = True
scene['AvatarAtelier'] = 'Procedural primitive avatar. Separate editable meshes; humanoid armature; facial shape keys.'
if target.endswith('.fbx'):
    # Export all mesh parts and the armature, excluding stage/camera. Preserve blendshapes.
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type in {'MESH', 'ARMATURE'}: o.select_set(True)
    if rigs: bpy.context.view_layer.objects.active = rigs[0]
    bpy.ops.export_scene.fbx(filepath=os.path.abspath(target), use_selection=True,
        object_types={'MESH', 'ARMATURE'}, add_leaf_bones=False, use_mesh_modifiers=False,
        bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
        axis_forward='-Z', axis_up='Y', apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS',
        mesh_smooth_type='FACE', path_mode='AUTO')
else:
    # Keep the asset editable; give first open a useful material viewport and framing.
    bpy.ops.object.select_all(action='DESELECT')
    for rig in rigs: rig.select_set(True)
    if rigs: bpy.context.view_layer.objects.active = rigs[0]
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 3.4
                area.spaces.active.region_3d.view_location = Vector((0, 0, 1.0))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(target))
print('AVATAR_EXPORT_OK', target)
