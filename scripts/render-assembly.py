"""Renderiza a cena final com Cycles usando o mesmo modelo da página.

blender -b -t 8 --factory-startup --python scripts/render-assembly.py -- /tmp/central.png 1320 960 40
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
LAYOUT = json.loads((ROOT / 'js/assembly-layout.js').read_text().strip().removeprefix('export default ').removesuffix(';'))
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
target, width, height, samples = args or ['/tmp/central.png', '1320', '960', '40']

def xyz(v):
    return (v[0], -v[2], v[1])

def linear(value):
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4

def rgba(value):
    return tuple(linear(int(value[i:i+2], 16) / 255) for i in (1,3,5)) + (1,)

def surface(name, params):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(params['color'])
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
    bsdf.inputs['Metallic'].default_value = params.get('metal', 0)
    bsdf.inputs['Roughness'].default_value = params.get('rough', .4)
    if params.get('glass'):
        bsdf.inputs['Transmission Weight'].default_value = params['glass']
        bsdf.inputs['IOR'].default_value = 1.46
        bsdf.inputs['Coat Weight'].default_value = .27
        bsdf.inputs['Coat Roughness'].default_value = .10
    if params.get('glow'):
        bsdf.inputs['Emission Color'].default_value = mat.diffuse_color
        bsdf.inputs['Emission Strength'].default_value = params['glow']
    if name in ('titanium', 'chrome', 'base', 'carbon', 'frame', 'studio'):
        anisotropy = bsdf.inputs.get('Anisotropic')
        if anisotropy is not None:
            anisotropy.default_value = .28 if name in ('titanium','chrome') else .08
        coords = nodes.new('ShaderNodeTexCoord')
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 180
        noise.inputs['Detail'].default_value = 2
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .15 if name == 'studio' else .08
        bump.inputs['Distance'].default_value = .018 if name == 'studio' else .004
        mat.node_tree.links.new(coords.outputs['Object'], noise.inputs['Vector'])
        mat.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {key: surface(key, value) for key,value in LAYOUT['materials'].items()}
materials['studio'] = surface('studio', {'color':'#0d1a2e','metal':.26,'rough':.38})

for part in LAYOUT['parts']:
    for kind, material, offset, size, bevel in part['items']:
        position = xyz([a+b for a,b in zip(part['base'],offset)])
        if kind == 'box':
            bpy.ops.mesh.primitive_cube_add(size=1, location=position)
            obj = bpy.context.object
            obj.scale = (size[0],size[2],size[1])
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=size[0], depth=size[1], location=position)
            obj = bpy.context.object
            bevel = .004
        obj.name = part['name']
        obj.data.materials.append(materials[material])
        if bevel:
            modifier = obj.modifiers.new('Bordas usinadas', 'BEVEL')
            modifier.width = bevel
            modifier.segments = 3
            modifier.harden_normals = True
            obj.modifiers.new('Normais ponderadas', 'WEIGHTED_NORMAL')
    for material, coords, radius in part.get('cables', []):
        data = bpy.data.curves.new('Ligação de dados', 'CURVE')
        data.dimensions = '3D'
        data.bevel_depth = radius
        data.bevel_resolution = 3
        spline = data.splines.new('POLY')
        spline.points.add(len(coords)-1)
        for p, offset in zip(spline.points, coords):
            p.co = (*xyz([a+b for a,b in zip(part['base'],offset)]), 1)
        obj = bpy.data.objects.new('Ligação de dados', data)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials[material])

bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.105))
bpy.context.object.name = 'Fundo do estúdio'
bpy.context.object.data.materials.append(materials['studio'])

def aim(obj, at):
    obj.rotation_euler = (Vector(xyz(at)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def light(name, position, point, energy, rgb, size, shape='DISK'):
    data = bpy.data.lights.new(name, type='AREA')
    data.energy = energy
    data.color = rgb
    data.shape = shape
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = xyz(position)
    aim(obj, point)

light('Softbox principal', [1.6,6.2,3.8], [0,0,0], 960, (.88,.94,1), 5.7)
light('Recorte azul', [1.5,5.6,-5.5], [0,.7,0], 1240, (.27,.49,1), 4.5, 'RECTANGLE')
light('Recorte quente', [-5.2,2.5,1.85], [0,0,0], 960, (1,.53,.24), 3.7)
light('Reflexo vertical', [5.7,2.05,-1.0], [0,.7,0], 850, (.35,.71,1), 3.6)
light('Luz interna', [0,1.49,.36], [0,.80,.18], 23, (1,.53,.20), .35)
light('Luz de preenchimento', [-3.2,3.7,-2], [0,.65,0], 750, (.70,.84,1), 3.7)

camera_data = bpy.data.cameras.new('Câmera de apresentação')
camera = bpy.data.objects.new('Câmera de apresentação', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = xyz(LAYOUT['camera']['position'])
aim(camera, LAYOUT['camera']['target'])
camera_data.sensor_fit = 'VERTICAL'
camera_data.angle_y = math.radians(LAYOUT['camera']['fov'])
scene = bpy.context.scene
scene.camera = camera
scene.world.use_nodes = True
world = scene.world.node_tree.nodes.get('Background')
world.inputs['Color'].default_value = rgba('#8caed0')
world.inputs['Strength'].default_value = .18
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(samples)
scene.cycles.use_denoising = False
scene.cycles.adaptive_threshold = .016
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 5
scene.view_settings.exposure = -.36
scene.render.resolution_x = int(width)
scene.render.resolution_y = int(height)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(Path(target).resolve())
scene.use_nodes = True
node_tree = scene.node_tree
node_tree.nodes.clear()
render = node_tree.nodes.new('CompositorNodeRLayers')
glare = node_tree.nodes.new('CompositorNodeGlare')
glare.glare_type = 'FOG_GLOW'
glare.threshold = 1.43
glare.size = 7
composite = node_tree.nodes.new('CompositorNodeComposite')
node_tree.links.new(render.outputs['Image'], glare.inputs['Image'])
node_tree.links.new(glare.outputs['Image'], composite.inputs['Image'])
bpy.ops.render.render(write_still=True)
