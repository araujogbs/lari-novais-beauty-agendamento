using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Data;
using AgendamentoApi.Models;

namespace AgendamentoApi.Controllers;

[ApiController]
[Route("api/[controller]")] // A rota base será /api/services
public class ServicesController : ControllerBase
{
    private readonly AppDbContext _context;

    // O .NET injeta a conexão do banco automaticamente aqui pelo construtor
    public ServicesController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/services (Lista todos os serviços ativos)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ServiceItem>>> GetServices()
    {
        // LINQ: busca todos os itens onde IsActive é verdadeiro de forma assíncrona
        var services = await _context.Services
            .Where(s => s.IsActive)
            .ToListAsync();

        return Ok(services); // Retorna HTTP 200 com a lista em JSON
    }

    // GET: api/services/5 (Busca um serviço específico pelo ID)
    [HttpGet("{id}")]
    public async Task<ActionResult<ServiceItem>> GetServiceById(int id)
    {
        var service = await _context.Services.FindAsync(id);

        if (service == null)
        {
            return NotFound(new { message = "Serviço não encontrado" }); // HTTP 404
        }

        return Ok(service);
    }

    // POST: api/services (Cadastra um novo serviço da maquiadora)
    [HttpPost]
    public async Task<ActionResult<ServiceItem>> CreateService(ServiceItem service)
    {
        // Adiciona no contexto e salva no banco de dados
        _context.Services.Add(service);
        await _context.SaveChangesAsync();

        // Retorna HTTP 201 Created com a rota para consultar o item recém-criado
        return CreatedAtAction(nameof(GetServiceById), new { id = service.Id }, service);
    }
}