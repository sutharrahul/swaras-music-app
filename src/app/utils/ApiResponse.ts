export class ApiResponce {
  static success(message: string, data: any = null, status: number) {
    return Response.json(
      {
        success: true,
        message,
        data,
      },
      {
        status,
      }
    );
  }

  static error(message: string, status: number) {
    return Response.json(
      {
        success: false,
        message,
      },
      {
        status,
      }
    );
  }
}
