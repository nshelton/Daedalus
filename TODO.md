need better telemetry for the plotter.
I want to know how long it takes to plot a given path. Something is weird with the "queue saize" and commands completed".
I guess i don't initially know the "commands ocmpleted" because each path can emit multiple commands.
But could base progress based on the paths drawn, or total length of paths drawn.

It would be nice to get a time taken / percentage -> time remaining diagnostic in the gui.

---

Buttons and layout could use some work, but functional enough for now.
---

Exciting next part is to get the raster data rendered and displayed in the gui.
then, some form of "raster filters". I think there is a pipeline:
- raw raster
- resample
- threshold / posterize
- vectorize (crosshatch)

This is one path, which could all be built into one, or multiple steps.

Another step is to
- generate gradient field
- rasterize gradient field

---
Easy next featur
Add a rendering menu, maybe just to the layers control gui
- render points
- show plotted path

Dark mode / invert colors

Live update actual plotter position (x/y lines over the whole page

---

verificaiton of the plotter scale and size, associated with the A3 grid render on the app


----

raster - plot chain
raster filters:
 - CLAHE

raster->vector
 - 


path simplifier filter!
