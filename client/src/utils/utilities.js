export const drawRect = (detections, ctx) => {
    detections.forEach(detection => {
        const [x, y, width, height] = detection["bbox"]
        const text = detection["class"]

        const color = "green"
        ctx.strokeStyle = color
        ctx.font = "18px calibri"
        ctx.fillStyle = color


        ctx.beginPath()
        ctx.fillText(text, x, y)
        ctx.rect(x, y, width, height)
        ctx.stroke()

    })
}


