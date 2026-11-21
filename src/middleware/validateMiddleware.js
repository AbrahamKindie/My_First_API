
import fs from "node:fs/promises";
import path from "node:path";

// ==========================================
// ALLOWED UPLOAD DIRECTORIES
// ==========================================


const ALLOWED_UPLOAD_DIRECTORIES = new Set([
  path.resolve(process.cwd(), "uploads", "products"),
  path.resolve(process.cwd(), "uploads", "categories"),
  path.resolve(process.cwd(), "uploads", "profiles"),
  path.resolve(process.cwd(), "uploads", "shops", "logos"),
  path.resolve(process.cwd(), "uploads", "shops", "covers"),
]);


// ==========================================
// CLEANUP UPLOADED FILES
// ==========================================

const cleanupUploadedFiles = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    files.map(async (file) => {
      if (!file?.filename || !file?.destination) {
        return;
      }

      const filename = path.basename(file.filename);

      // Prevent path traversal.
      if (filename !== file.filename) {
        return;
      }

      // Only trust recognized Multer destinations.
      const directory = path.resolve(file.destination);

      if (!ALLOWED_UPLOAD_DIRECTORIES.has(directory)) {
        return;
      }

      const filePath = path.resolve(directory, filename);

      // Ensure the final path remains inside the directory.
      if (path.dirname(filePath) !== directory) {
        return;
      }

      await fs.unlink(filePath);
    })
  );

  results.forEach((result) => {
    if (
      result.status === "rejected" &&
      result.reason?.code !== "ENOENT"
    ) {
      console.error(
        "Uploaded image cleanup failed:",
        result.reason
      );
    }
  });
};

// ==========================================
// GET ALL UPLOADED FILES
// ==========================================

const getUploadedFiles = (req) => {
  const files = [];

  // Multer .single()
  if (req.file) {
    files.push(req.file);
  }

  // Multer .array()
  if (Array.isArray(req.files)) {
    files.push(...req.files);
  }

  // Multer .fields()
  if (
    req.files &&
    !Array.isArray(req.files) &&
    typeof req.files === "object"
  ) {
    Object.values(req.files).forEach((fieldFiles) => {
      if (Array.isArray(fieldFiles)) {
        files.push(...fieldFiles);
      }
    });
  }

  return files;
};

// ==========================================
// CHECK ACTUAL UPDATE DATA
// ==========================================

const hasActualUpdateData = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return false;
  }

  return Object.values(data).some((value) => {
    if (value === undefined || value === null) {
      return false;
    }

    // Ignore empty strings.
    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    // Empty arrays are valid updates.
    if (Array.isArray(value)) {
      return true;
    }

    // false and 0 are valid updates.
    return true;
  });
};

// ==========================================
// DETECT REQUEST-LEVEL ZOD SCHEMAS
// ==========================================

const isRequestSchema = (schema) => {
  if (
    !schema?.shape ||
    typeof schema.shape !== "object"
  ) {
    return false;
  }

  return ["body", "params", "query"].some((key) =>
    Object.prototype.hasOwnProperty.call(
      schema.shape,
      key
    )
  );
};

// ==========================================
// REQUEST VALIDATION MIDDLEWARE
// ==========================================

const validate = (
  schema,
  {
    cleanupUploads = false,
    requireUpdateData = false,
    source = "body",
  } = {}
) => {
  return async (req, res, next) => {
    try {
      // ==========================================
      // VALIDATE CONFIGURATION
      // ==========================================

      const allowedSources = [
        "body",
        "params",
        "query",
      ];

      if (!allowedSources.includes(source)) {
        throw new Error(
          `Invalid validation source: ${source}`
        );
      }

      if (typeof schema?.safeParse !== "function") {
        throw new Error(
          "A valid Zod schema must be provided."
        );
      }

      // ==========================================
      // PREPARE REQUEST DATA
      // ==========================================

      const requestSchema = isRequestSchema(schema);

      let dataToValidate;

      if (requestSchema) {
        dataToValidate = {
          body: req.body ?? {},
          params: req.params ?? {},
          query: req.query ?? {},
        };
      } else {
        switch (source) {
          case "query":
            dataToValidate = req.query ?? {};
            break;

          case "params":
            dataToValidate = req.params ?? {};
            break;

          default:
            dataToValidate = req.body ?? {};
        }
      }

      // ==========================================
      // VALIDATE REQUEST
      // ==========================================

      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        if (cleanupUploads) {
          await cleanupUploadedFiles(
            getUploadedFiles(req)
          );
        }

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      // ==========================================
      // CHECK EMPTY UPDATE DATA
      // ==========================================

      if (requireUpdateData) {
        const updateData = requestSchema
          ? result.data.body ?? {}
          : result.data;

        const hasFiles =
          getUploadedFiles(req).length > 0;

        if (
          !hasActualUpdateData(updateData) &&
          !hasFiles
        ) {
          if (cleanupUploads) {
            await cleanupUploadedFiles(
              getUploadedFiles(req)
            );
          }

          return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: [
              {
                field: "",
                message:
                  "At least one field or image must be provided for update.",
              },
            ],
          });
        }
      }

      // ==========================================
      // APPLY VALIDATED DATA
      // ==========================================

      if (requestSchema) {
        if (
          Object.prototype.hasOwnProperty.call(
            result.data,
            "body"
          )
        ) {
          req.body = result.data.body ?? {};
        }

        if (
          Object.prototype.hasOwnProperty.call(
            result.data,
            "params"
          )
        ) {
          req.params = result.data.params ?? {};
        }

        if (
          Object.prototype.hasOwnProperty.call(
            result.data,
            "query"
          )
        ) {
          req.validatedQuery =
            result.data.query ?? {};
        }
      } else {
        switch (source) {
          case "query":
            req.validatedQuery = result.data;
            break;

          case "params":
            req.params = result.data;
            break;

          default:
            req.body = result.data;
        }
      }

      return next();
    } catch (error) {
      console.error(
        "Request Validation Middleware Error:",
        error
      );

      if (cleanupUploads) {
        await cleanupUploadedFiles(
          getUploadedFiles(req)
        );
      }

      return res.status(500).json({
        success: false,
        message:
          "An error occurred while validating the request.",
      });
    }
  };
};

export default validate;
