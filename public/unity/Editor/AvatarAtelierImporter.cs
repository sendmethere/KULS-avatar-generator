using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

public static class AvatarAtelierImporter
{
    [MenuItem("Avatar Atelier/Configure selected FBX as Humanoid")]
    public static void ConfigureSelected()
    {
        var path = AssetDatabase.GetAssetPath(Selection.activeObject);
        if (!(AssetImporter.GetAtPath(path) is ModelImporter))
        {
            EditorUtility.DisplayDialog("Avatar Atelier", "Project 창에서 내보낸 FBX 파일을 선택해 주세요.", "확인");
            return;
        }
        Configure(path);
    }
    public static void Configure(string path)
    {
        var importer = (ModelImporter)AssetImporter.GetAtPath(path);
        importer.animationType = ModelImporterAnimationType.Human;
        importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
        importer.importBlendShapes = true;
        importer.importAnimation = true;
        importer.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
        importer.SaveAndReimport();
        var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        var existing = model.GetComponentsInChildren<Transform>(true).Select(t => t.name).ToHashSet();
        var human = new List<HumanBone>();
        // Unity uses "Left Eye" for HumanTrait names, and LeftEye for transform names.
        foreach (var humanName in HumanTrait.BoneName)
        {
            var boneName = humanName.Replace(" ", "");
            if (existing.Contains(boneName)) human.Add(new HumanBone {
                humanName = humanName, boneName = boneName, limit = new HumanLimit { useDefaultValues = true }
            });
        }
        var description = importer.humanDescription;
        description.human = human.ToArray();
        importer.humanDescription = description;
        var clips = importer.defaultClipAnimations;
        foreach (var clip in clips) { clip.loopTime = true; clip.loopPose = true; }
        importer.clipAnimations = clips;
        importer.SaveAndReimport();
        Debug.Log("Avatar Atelier: Humanoid configured: " + path);
    }
}
