using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
public static class UnityValidation
{
    public static void Run()
    {
        try
        {
            foreach (var path in new[] { "Assets/Milo.fbx", "Assets/Leo-child.fbx" })
            {
                if (!File.Exists(path)) continue;
                AvatarAtelierImporter.Configure(path);
                var assets = AssetDatabase.LoadAllAssetsAtPath(path);
                var avatar = assets.OfType<Avatar>().FirstOrDefault();
                if (avatar == null || !avatar.isValid || !avatar.isHuman) throw new Exception(path + " invalid humanoid avatar");
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                var meshes = model.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                if (meshes.Length < 20) throw new Exception("Missing skinned meshes: " + meshes.Length);
                var shapes = meshes.Sum(m => m.sharedMesh.blendShapeCount);
                if (shapes < 60) throw new Exception("Missing shape keys: " + shapes);
                var clips = assets.OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview__")).ToArray();
                if (clips.Length < 2) throw new Exception("Missing animation clips");
                var obj = (GameObject)PrefabUtility.InstantiatePrefab(model);
                obj.AddComponent<AvatarExpressionDriver>();
                var anim = obj.GetComponent<Animator>();
                if (anim.GetBoneTransform(HumanBodyBones.Head) == null || anim.GetBoneTransform(HumanBodyBones.LeftFoot) == null) throw new Exception("Missing mapped bones");
                Debug.Log("ATELIER_UNITY_PASS " + path + " human=" + avatar.isHuman + " valid=" + avatar.isValid + " skinnedMeshes=" + meshes.Length + " shapeKeys=" + shapes + " clips=" + string.Join(",", clips.Select(c=>c.name)));
                UnityEngine.Object.DestroyImmediate(obj);
            }
            EditorApplication.Exit(0);
        }
        catch (Exception e) { Debug.LogException(e); EditorApplication.Exit(1); }
    }
}
