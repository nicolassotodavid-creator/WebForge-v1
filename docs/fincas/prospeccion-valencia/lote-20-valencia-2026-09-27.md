# [FINCAS] Lote 20 — Valencia ciudad + área metropolitana (27-sep-2026)

Pool: 200 administradores de fincas únicos escaneados (Valencia + Torrent, Paterna, Mislata, Burjassot,
Alboraya, Catarroja, Xirivella, Manises, Quart de Poblet, Aldaia, Alfafar, Sedaví, Massanassa, Bétera,
Godella, L'Eliana, Alaquàs, Meliana, Rocafort) → 78 con ≥15 reseñas y sin ser franquicia proptech (Housfy,
Tecnocasa...) → 30 reseñas más recientes leídas por cada uno → 23 con queja de teléfono/incidencia en sus
propias reseñas → 20 finales con email verificado en su propia web (nunca sacado de Maps).
Coste Apify: ~2,41 $ (3 runs).

Criterio de selección (por orden de prioridad):
1. **14 con DOLOR real**: su propia reseña dice literalmente que no cogen el teléfono / no responden
   emails / no atienden incidencias. Es el problema exacto que resuelve el asistente de voz — el email
   puede citar su propia reseña.
2. **6 de relleno**: mismo pool, sin cita de teléfono pero con el rating más bajo del resto (peor
   reputación general) para completar los 20.

Excluidos del pool: colegio profesional (no es empresa), franquicias proptech, sin web + sin email
localizable, duplicados de Maps (misma empresa con 2 fichas → 1 sola fila).

## Los 14 con dolor citado (prioridad de envío)

| # | Empresa | Email | Teléfono | Reseña propia (1★) |
|---|---|---|---|---|
| 1 | Administraciones Cutillas, S.L. | admon@cutillassl.es | +34 963 91 99 21 | «Resulta imposible contactar con el administrador.» |
| 2 | Administraciones Murga | afmurga@afmurga.es | +34 963 81 55 51 | «No contestan al teléfono ni al email...» |
| 3 | Castañeyra & Asociados (CLEP) | administracion@castaneyra.es | +34 962 07 12 22 | «Y ahora no responde el teléfono» |
| 4 | Asesoramiento y Gestión | asesoramientoygestioncbsl@gmail.com | +34 963 73 87 03 | «Ahora entiendo porque no atienden el telf...» |
| 5 | A & M Gestión Urbana, C.B. | info@gestion-urbana.com | +34 963 84 66 51 | «No responden ningún e-mail, no cogen el teléfono cuando llamamos...» |
| 6 | Ensanche Administraciones | ensanche@ensancheadministraciones.com | +34 963 52 44 90 | «Nunca responden, te dan largas, ya llamarán, no dan la cara...» |
| 7 | Fincas Florit | info@fincasflorit.es | +34 960 04 56 42 | «No contestan el teléfono.» |
| 8 | Administraciones Yak | info@administracionesyak.com | +34 963 23 40 73 | «...no cogen el teléfono, no contestan a los correos...» |
| 9 | Profinkas - La Plata | info@profinkas.es | +34 963 81 31 91 | «...imposible contactar con ellos, no te devuelven las llamadas...» |
| 10 | Grupo APARISI | gestion@grupoaparisi.com | +34 963 35 45 00 | «...no atienden peticiones del Presidente y propietarios.» |
| 11 | Grupo Palacios | info@grupopalacios.com | +34 963 28 88 82 | «No cogen el teléfono, siempre que llamo se pone el contestador...» |
| 12 | Ortifincas, S.L. | ortifincas@ortifincas.com | +34 963 94 07 37 | «Nunca cogen el teléfono.» |
| 13 | Luis Fernando López de Briñas | lbmadmon@yahoo.es | +34 963 68 82 80 | «...por la tarde nadie atiende el teléfono.» |
| 14 | Raúl Oscar Galán Arteta | fincaslafamilia@gmail.com | — | «No responden al teléfono, no contestan emails de los Presidentes.» |

## 6 de relleno (peor rating general, sin cita de teléfono)

| # | Empresa | Email | Teléfono | Rating |
|---|---|---|---|---|
| 15 | Administraciones Tamarit-Flórez | administracion@gftamarit.es | +34 963 32 33 29 | 2,6 |
| 16 | Gefinco Gestión de Inmuebles | info@gefincosl.com | +34 963 30 25 96 | 2,9 |
| 17 | Ruiz Mauri S.L. | ruiz-mauri@ruiz-mauri.es | +34 963 77 75 70 | 2,9 |
| 18 | Mediterráneo Administración de Fincas | info@mediterraneoglobal.es | +34 963 11 62 02 | 3,0 |
| 19 | Admón. Fincas Alejo y Rosa | admon@adfincas-ar.es | +34 696 28 60 61 | 3,1 |
| 20 | Adm. de Fincas F.M. Portaña | monica.portanya@gmail.com | +34 963 85 75 03 | 3,1 |

## Siguiente paso

Falta redactar el email (texto corto, cita real, sin pinta de plantilla, como en WEBS) y el gate de QA
antes de enviar — nada de esto se ha contactado todavía. Ficheros: `fincas_valencia.csv` (78 filas
completas), `senales-detalle.json` (todas las citas por empresa), `raw-pass2.json` (reseñas crudas).
