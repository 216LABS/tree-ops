-- Shared reference rows. Tenants can add their own; these are a starting list, not an authority.

-- Common North American landscape trees. Typed by the team (docs/SPEC.md section 14: no licensed list was found).
insert into species (common_name, latin_name, is_pine) values
  ('Red maple', 'Acer rubrum', false), ('Silver maple', 'Acer saccharinum', false), ('Sugar maple', 'Acer saccharum', false),
  ('Norway maple', 'Acer platanoides', false), ('Boxelder', 'Acer negundo', false), ('Japanese maple', 'Acer palmatum', false),
  ('White oak', 'Quercus alba', false), ('Red oak', 'Quercus rubra', false), ('Pin oak', 'Quercus palustris', false),
  ('Bur oak', 'Quercus macrocarpa', false), ('Live oak', 'Quercus virginiana', false), ('Water oak', 'Quercus nigra', false),
  ('Willow oak', 'Quercus phellos', false), ('Green ash', 'Fraxinus pennsylvanica', false), ('White ash', 'Fraxinus americana', false),
  ('American elm', 'Ulmus americana', false), ('Siberian elm', 'Ulmus pumila', false), ('Honeylocust', 'Gleditsia triacanthos', false),
  ('Black locust', 'Robinia pseudoacacia', false), ('Callery pear', 'Pyrus calleryana', false), ('Crabapple', 'Malus spp.', false),
  ('Black cherry', 'Prunus serotina', false), ('Flowering cherry', 'Prunus serrulata', false), ('Eastern redbud', 'Cercis canadensis', false),
  ('Flowering dogwood', 'Cornus florida', false), ('River birch', 'Betula nigra', false), ('Paper birch', 'Betula papyrifera', false),
  ('American sycamore', 'Platanus occidentalis', false), ('London planetree', 'Platanus x acerifolia', false),
  ('Tulip tree', 'Liriodendron tulipifera', false), ('Sweetgum', 'Liquidambar styraciflua', false), ('Black walnut', 'Juglans nigra', false),
  ('Shagbark hickory', 'Carya ovata', false), ('Pecan', 'Carya illinoinensis', false), ('American beech', 'Fagus grandifolia', false),
  ('American basswood', 'Tilia americana', false), ('Littleleaf linden', 'Tilia cordata', false), ('Eastern cottonwood', 'Populus deltoides', false),
  ('Quaking aspen', 'Populus tremuloides', false), ('Weeping willow', 'Salix babylonica', false), ('Black willow', 'Salix nigra', false),
  ('Southern magnolia', 'Magnolia grandiflora', false), ('Ginkgo', 'Ginkgo biloba', false), ('Bradford pear', 'Pyrus calleryana ''Bradford''', false),
  ('Mulberry', 'Morus spp.', false), ('Hackberry', 'Celtis occidentalis', false), ('Tree of heaven', 'Ailanthus altissima', false),
  ('Crape myrtle', 'Lagerstroemia indica', false), ('Bald cypress', 'Taxodium distichum', false), ('Arborvitae', 'Thuja occidentalis', false),
  ('Eastern red cedar', 'Juniperus virginiana', false), ('Eastern hemlock', 'Tsuga canadensis', false), ('Norway spruce', 'Picea abies', false),
  ('Colorado blue spruce', 'Picea pungens', false), ('White spruce', 'Picea glauca', false), ('Douglas fir', 'Pseudotsuga menziesii', false),
  ('Eastern white pine', 'Pinus strobus', true), ('Loblolly pine', 'Pinus taeda', true), ('Austrian pine', 'Pinus nigra', true),
  ('Scots pine', 'Pinus sylvestris', true), ('Slash pine', 'Pinus elliottii', true), ('Longleaf pine', 'Pinus palustris', true),
  ('Ponderosa pine', 'Pinus ponderosa', true), ('Palm', 'Arecaceae', false);

-- Pre-work rules. Only rows with a source someone opened are marked verified.
insert into prework_rules (state_code, city, kind, trigger, lead_days, valid_days, source_note, verified) values
  (null, null, '811', '{"line_kinds":["stump_grind","clearing"]}', 2, null,
   'Call 811 before digging or grinding. Lead time varies by state; 2 business days is common. Check your state.', false),
  ('OH', null, '811', '{"line_kinds":["stump_grind","clearing"]}', 2, null,
   'Ohio: notify at least 48 hours and no more than 10 working days before digging (ORC 3781.28). Ticket life not verified.', true),
  (null, null, 'utility_line', '{"near_lines":["service_le_750v","dist_le_35kv","gt_35kv"]}', null, null,
   'A tree is marked near power lines: confirm clearance, crew electrical level and any utility coordination before scheduling.', false),
  ('GA', 'Atlanta', 'permit', '{"min_dbh_in":6,"pine_min_dbh_in":12,"line_kinds":["remove"]}', null, null,
   'Atlanta: permit for trees 6 in DBH or more (12 in for pines); dead, dying or hazardous trees still need a permit (Trees Atlanta).', true);
