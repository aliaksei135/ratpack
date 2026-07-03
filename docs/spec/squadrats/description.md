# What are Squadrats

Squadrats are nothing but specific zoom levels of a standard web mercator (EPSG:3857). Specifically, 'Squadrats' are 256x256px tiles at zoom level 14 and 'Squadratinhos' are 256x256px tiles at zoom level 17.

These are fully compatible with the zoom indexing system commonly used by 'slippy' style web maps. The tile coordinates, $x$ and $y$, can be calculated from a longitude, $\lambda$, and a latitude, $\phi$, when both are in radians, by:

$$
  x &= \left\lfloor\frac{1}{2\pi} \cdot 2^{\text{zoom level}} \left(\pi + \lambda \right)\right\rfloor \text{ pixels}
  y &= \left\lfloor\frac{1}{2\pi} \cdot 2^{\text{zoom level}} \left(\pi - \ln \left[\tan \left(\frac{\pi}{4} + \frac{\varphi}{2} \right) \right]\right)\right\rfloor \text{ pixels}
$$
