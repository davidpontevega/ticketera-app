import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

vi.stubEnv("S3_MEDIA_BUCKET", "media-bucket");
vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://cdn.test/media");

const { uploadDataUrlImage } = await import("./s3");

beforeEach(() => send.mockReset().mockResolvedValue({}));

describe("uploadDataUrlImage", () => {
  it("sube el data URL a media/<folder>/ y devuelve la URL publica", async () => {
    const url = await uploadDataUrlImage("data:image/png;base64,aGVsbG8=", "events");

    const { input } = send.mock.calls[0][0];
    expect(input).toMatchObject({ Bucket: "media-bucket", ContentType: "image/png" });
    expect(input.Key).toMatch(/^media\/events\/[0-9a-f-]{36}\.png$/);
    expect(Buffer.from(input.Body).toString()).toBe("hello");
    expect(url).toBe(`https://cdn.test/media/${input.Key.slice("media/".length)}`);
  });

  it.each(["https://images.unsplash.com/a.jpg", "https://cdn.test/media/events/x.jpg", ""])(
    "devuelve %j sin subir nada",
    async (value) => {
      expect(await uploadDataUrlImage(value, "events")).toBe(value);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
