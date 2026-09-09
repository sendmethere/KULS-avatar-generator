using System;
using System.Collections.Generic;
using UnityEngine;

// Add to the imported avatar root. Works with Blender and glTF-style blendshape names.
public class AvatarExpressionDriver : MonoBehaviour
{
    public enum Expression { Neutral, Smile, Serious, Sad, Angry, Surprised }
    public Expression expression = Expression.Smile;
    [Range(0, 1)] public float intensity = 0.7f;
    [Range(-35, 35)] public float gazeHorizontal;
    [Range(-25, 25)] public float gazeVertical;
    public bool autoBlink = true;
    [Range(0, 1)] public float blink;
    struct Shape { public SkinnedMeshRenderer renderer; public int index; public string name; }
    readonly List<Shape> shapes = new List<Shape>();
    Transform leftEye, rightEye;
    Quaternion leftRest, rightRest;
    void Awake()
    {
        foreach (var renderer in GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            var mesh = renderer.sharedMesh;
            if (mesh == null) continue;
            for (int i = 0; i < mesh.blendShapeCount; i++)
            {
                var name = mesh.GetBlendShapeName(i).ToLowerInvariant();
                var split = name.LastIndexOf('.');
                if (split >= 0) name = name.Substring(split + 1);
                shapes.Add(new Shape { renderer = renderer, index = i, name = name });
            }
        }
        foreach (var bone in GetComponentsInChildren<Transform>(true))
        {
            if (bone.name == "LeftEye") leftEye = bone;
            if (bone.name == "RightEye") rightEye = bone;
        }
        if (leftEye != null) leftRest = leftEye.localRotation;
        if (rightEye != null) rightRest = rightEye.localRotation;
    }
    void LateUpdate()
    {
        float phase = Time.time % 4.8f;
        float blinkWeight = autoBlink ? Mathf.Max(blink, 1 - Mathf.Abs(phase - 4.5f) / 0.105f) : blink;
        string active = expression.ToString().ToLowerInvariant();
        foreach (var shape in shapes)
        {
            float weight = shape.name == "blink" ? Mathf.Clamp01(blinkWeight) : shape.name == active ? intensity : 0;
            shape.renderer.SetBlendShapeWeight(shape.index, weight * 100);
        }
        // Imported FBX bone axes can differ; rotate in the avatar root's coordinate frame.
        var delta = Quaternion.AngleAxis(gazeHorizontal, transform.up) * Quaternion.AngleAxis(-gazeVertical, transform.right);
        if (leftEye != null) leftEye.rotation = delta * (leftEye.parent.rotation * leftRest);
        if (rightEye != null) rightEye.rotation = delta * (rightEye.parent.rotation * rightRest);
    }
}
