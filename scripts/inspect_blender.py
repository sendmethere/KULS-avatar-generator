import bpy, sys, json, os
paths = sys.argv[sys.argv.index('--') + 1:]
reports = []
for path in paths:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.endswith('.blend'): bpy.ops.wm.open_mainfile(filepath=os.path.abspath(path))
    elif path.endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=os.path.abspath(path))
    else: bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not any(c.hide_render for c in o.users_collection)]
    assert len(rigs) == 1, f'{path}: expected one rig'
    assert len(rigs[0].data.bones) == 24, f'{path}: incorrect bone count'
    assert all(any(m.type == 'ARMATURE' for m in o.modifiers) for o in meshes), 'unbound mesh'
    shape_names = {k.name for o in meshes if o.data.shape_keys for k in o.data.shape_keys.key_blocks}
    assert {'smile','serious','sad','angry','surprised','blink'}.issubset(shape_names), shape_names
    assert len(bpy.data.actions) >= 2, 'animations missing'
    assert all(len(v.groups) > 0 for o in meshes for v in o.data.vertices), 'unweighted vertex'
    report = {'file':os.path.basename(path),'meshes':len(meshes),'bones':len(rigs[0].data.bones),
        'vertices':sum(len(o.data.vertices) for o in meshes),'shape_keys':sorted(shape_names),
        'actions':[a.name for a in bpy.data.actions]}
    reports.append(report)
print('ROUNDTRIP_REPORT',json.dumps(reports))
