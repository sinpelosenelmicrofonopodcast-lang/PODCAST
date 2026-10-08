# AdSense para Sin Pelos — integración técnica del 8 de octubre de 2026

Cuenta de Google existente (AdSense para YouTube): `pub-4245621675541095`.
Correo asociado: sinpelosenelmicrofonopodcast@gmail.com.
Sitio: `sinpelosenelmicrofono.com` (canonical `www.sinpelosenelmicrofono.com`).

## Hecho en website
- Etiqueta Google `<meta name="google-adsense-account" content="ca-pub-4245621675541095">` instalada en root layout como metadata.
- Publicación de `/ads.txt` vía Next.js route con entrada `google.com, pub-4245621675541095, DIRECT, f08c47fec0942fa0`.
- Privacidad explicita futuras tecnologías publicitarias y las opciones de Google.
- No se instaló `adsbygoogle.js`, no se habilitó Auto ads y no se afirma que AdSense haya aprobado el sitio.
- Las noticias sensibles y zonas privadas deben quedar excluidas de placements publicitarios.

## Acciones Google pendientes (solo panel autenticado AdSense)
1. Entrar a https://adsense.google.com/start/ con la **cuenta existente**, no abrir otra cuenta con distinto beneficiario.
2. Si no existe pestaña *Sites / Sitios*, completar ampliación de AdSense para YouTube a AdSense para contenido bajo el mismo payee.
3. En *Sites*, añadir `sinpelosenelmicrofono.com` una sola vez. No introducir URL con subdominio ni rutas.
4. Seleccionar verificación por `meta tag` o `ads.txt`, confirmar y presionar **Verify / Verificar**.
5. Clic en **Request review / Solicitar revisión**. No presentar el dominio como aprobado hasta que indique **Ready / Listo**.
6. Revisar *Privacy & messaging* y seleccionar **Google CMP** para visitantes en EEA, Reino Unido y Suiza; agregar mensajes de regiones de EE.UU. cuando corresponda.
7. Si Google requiere identificación fiscal/persona/pagos, completarla en su panel oficial; nunca publicar esos datos en el sitio.
8. Tras la aprobación, agregar el script publicitario autorizado y probar placements limitados de forma consciente del consentimiento, sin interferir con el inventario de patrocinadores directos.

Fuentes:
- https://support.google.com/adsense/answer/9247020
- https://support.google.com/adsense/answer/7584263
- https://support.google.com/adsense/answer/13554116
- https://support.google.com/publisherpolicies/answer/10437794
