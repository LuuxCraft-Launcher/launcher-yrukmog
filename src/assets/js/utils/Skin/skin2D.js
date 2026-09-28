/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

export class skin2D {
    async creatHeadTexture(data) {
        let image = await getData(data)
        return await new Promise((resolve, reject) => {
            image.addEventListener('load', e => {
                let cvs = document.createElement('canvas');
                cvs.width = 8;
                cvs.height = 8;
                let ctx = cvs.getContext('2d');
                ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
                ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
                return resolve(cvs.toDataURL());
            });
        })
    }
}

async function getData(data) {
    if (data.startsWith('http')) {
        // Rapatrie en data: URL via le main process. Charger directement une
        // texture distante tainterait le canvas et ferait echouer toDataURL().
        data = await window.luuxAPI.net.skin(data);
    }
    let img = new Image();
    img.src = data;
    return img;
}