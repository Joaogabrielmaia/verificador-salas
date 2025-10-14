let currentData = { cities: [] };
let selectedCityIndex = -1;
let selectedFloorIndex = -1;
let editingFloorIndex = -1;
let socket = io();


document.addEventListener('DOMContentLoaded', function () {
    loadData();
    setupSocket();
});


function setupSocket() {
    socket.on('data_updated', (data) => {
        currentData = data;
        renderCities();
        renderTreeView();
        updateStats();
        Swal.fire({
            title: 'Dados Atualizados!',
            text: 'Os dados foram atualizados em tempo real',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    });
}


async function loadData() {
    try {
        const response = await fetch('/api/data');
        currentData = await response.json();
        renderCities();
        renderTreeView();
        updateStats();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        Swal.fire('Erro', 'Não foi possível carregar os dados', 'error');
    }
}


function renderCities() {
    const container = document.getElementById('citiesList');
    container.innerHTML = '';


    updateStats();

    currentData.cities.forEach((city, cityIndex) => {
        const totalRooms = city.floors.reduce((acc, floor) => acc + floor.rooms.length, 0);
        const totalPrinters = city.floors.reduce((acc, floor) => acc + floor.printers.length, 0);

        const cityCard = `
                    <div class="col-md-6 col-lg-4">
                        <div class="city-card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    <i class="bi bi-buildings me-2"></i>
                                    ${city.name}
                                </h5>
                                <span class="stats-badge">${city.floors.length} andar(es)</span>
                            </div>
                            <div class="room-divider"></div>
                            <div class="card-body">
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="text-muted">
                                            <i class="bi bi-layers me-1"></i>
                                            Andares
                                        </span>
                                        <strong>${city.floors.length}</strong>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="text-muted">
                                            <i class="bi bi-door-closed me-1"></i>
                                            Salas
                                        </span>
                                        <strong>${totalRooms}</strong>
                                    </div>
                                    <div class="d-flex justify-content-between">
                                        <span class="text-muted">
                                            <i class="bi bi-printer me-1"></i>
                                            Impressoras
                                        </span>
                                        <strong>${totalPrinters}</strong>
                                    </div>
                                </div>
                                
                                <div class="action-buttons mt-3">
                                    <button class="btn btn-outline-primary btn-sm" onclick="manageFloors(${cityIndex})">
                                        <i class="bi bi-layers me-1"></i>Gerenciar Andares
                                    </button>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-secondary" onclick="editCity(${cityIndex})">
                                            <i class="bi bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" onclick="deleteCity(${cityIndex})">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        container.innerHTML += cityCard;
    });

    if (currentData.cities.length === 0) {
        container.innerHTML = `
                    <div class="col-12">
                        <div class="empty-state">
                            <i class="bi bi-buildings"></i>
                            <h4 class="text-muted mt-3">Nenhuma cidade cadastrada</h4>
                            <p class="text-muted">Clique em "Nova Cidade" para começar</p>
                        </div>
                    </div>
                `;
    }
}


function updateStats() {
    const totalCities = currentData.cities.length;
    const totalFloors = currentData.cities.reduce((acc, city) => acc + city.floors.length, 0);
    const totalRooms = currentData.cities.reduce((acc, city) =>
        acc + city.floors.reduce((roomAcc, floor) => roomAcc + floor.rooms.length, 0), 0);
    const totalPrinters = currentData.cities.reduce((acc, city) =>
        acc + city.floors.reduce((printerAcc, floor) => printerAcc + floor.printers.length, 0), 0);

    document.getElementById('totalCities').textContent = totalCities;
    document.getElementById('totalFloors').textContent = totalFloors;
    document.getElementById('totalRooms').textContent = totalRooms;
    document.getElementById('totalPrinters').textContent = totalPrinters;
}


function renderTreeView() {
    const treeView = document.getElementById('treeView');
    treeView.innerHTML = '';

    currentData.cities.forEach((city, cityIndex) => {
        const cityItem = `
                    <div class="tree-item ${selectedCityIndex === cityIndex ? 'active' : ''}" 
                         onclick="selectTreeItem('city', ${cityIndex})">
                        <i class="bi bi-buildings me-2"></i>
                        ${city.name}
                    </div>
                `;
        treeView.innerHTML += cityItem;

        city.floors.forEach((floor, floorIndex) => {
            const isSelected = selectedCityIndex === cityIndex && selectedFloorIndex === floorIndex;
            const floorItem = `
                        <div class="tree-item ms-3 ${isSelected ? 'active' : ''}" 
                             onclick="selectTreeItem('floor', ${cityIndex}, ${floorIndex})">
                            <i class="bi bi-layers me-2"></i>
                            ${floor.label}
                            <span class="badge bg-primary rounded-pill ms-1">${floor.rooms.length}</span>
                        </div>
                    `;
            treeView.innerHTML += floorItem;
        });
    });
}


function openAddCityModal() {
    selectedCityIndex = -1;
    document.getElementById('cityModalTitle').textContent = 'Nova Cidade';
    document.getElementById('cityName').value = '';
    document.getElementById('floorsContainer').innerHTML = '';


    const addFloorBtn = document.querySelector('#cityModal .btn-outline-primary');
    if (addFloorBtn) {
        addFloorBtn.disabled = true;
        addFloorBtn.title = 'Salve a cidade primeiro para adicionar andares';
        addFloorBtn.innerHTML = '<i class="bi bi-plus"></i> Salve a cidade primeiro';
    }

    const modal = new bootstrap.Modal(document.getElementById('cityModal'));
    modal.show();
}


function editCity(cityIndex) {
    selectedCityIndex = cityIndex;
    const city = currentData.cities[cityIndex];

    document.getElementById('cityModalTitle').textContent = `Editar ${city.name}`;
    document.getElementById('cityName').value = city.name;
    document.getElementById('floorsContainer').innerHTML = '';


    const addFloorBtn = document.querySelector('#cityModal .btn-outline-primary');
    if (addFloorBtn) {
        addFloorBtn.disabled = false;
        addFloorBtn.title = 'Adicionar novo andar';
        addFloorBtn.innerHTML = '<i class="bi bi-plus"></i> Adicionar Andar';
    }


    city.floors.forEach((floor, floorIndex) => {
        addFloorToForm(floor, floorIndex);
    });

    const modal = new bootstrap.Modal(document.getElementById('cityModal'));
    modal.show();
}


function addFloorToForm(floor = null, floorIndex = -1) {
    const floorsContainer = document.getElementById('floorsContainer');
    const floorData = floor || { id: '', label: 'Novo Andar', rooms: [], printers: [] };

    const floorHtml = `
                <div class="card mb-2 floor-item" data-index="${floorIndex}">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${floorData.label}</strong>
                                <small class="text-muted ms-2">${floorData.rooms.length} salas, ${floorData.printers.length} impressoras</small>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button type="button" class="btn btn-outline-primary" onclick="openEditFloorModal(${floorIndex})">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button type="button" class="btn btn-outline-danger" onclick="deleteFloor(${floorIndex})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

    floorsContainer.innerHTML += floorHtml;
}


function removeFloorFromForm(floorIndex) {
    const floorElement = document.querySelector(`.floor-item[data-index="${floorIndex}"]`);
    if (floorElement) {
        floorElement.remove();
    }
}


function openEditFloorModal(floorIndex) {
    if (selectedCityIndex === -1) {
        Swal.fire('Atenção', 'Salve a cidade primeiro antes de adicionar andares', 'warning');
        return;
    }

    editingFloorIndex = floorIndex;

    if (floorIndex >= 0 && selectedCityIndex >= 0 && currentData.cities[selectedCityIndex]) {
        const floor = currentData.cities[selectedCityIndex].floors[floorIndex];
        document.getElementById('floorIdInput').value = floor.id; // Mude para o novo campo
        document.getElementById('floorLabel').value = floor.label;
        document.getElementById('floorRooms').value = floor.rooms.join('\n');
        document.getElementById('floorPrinters').value = floor.printers.join('\n');
        document.getElementById('floorModalTitle').textContent = 'Editar Andar';
    } else {
        document.getElementById('floorForm').reset();
        document.getElementById('floorIdInput').value = ''; // Mude para o novo campo
        document.getElementById('floorLabel').value = 'Novo Andar';
        document.getElementById('floorRooms').value = '';
        document.getElementById('floorPrinters').value = '';
        document.getElementById('floorModalTitle').textContent = 'Novo Andar';
    }

    const modal = new bootstrap.Modal(document.getElementById('floorModal'));
    modal.show();
}


function addNewFloor() {

    if (selectedCityIndex === -1) {
        Swal.fire('Atenção', 'Salve a cidade primeiro antes de adicionar andares', 'warning');
        return;
    }
    openEditFloorModal(-1);
}


async function saveFloor() {
    if (selectedCityIndex === -1) {
        Swal.fire('Erro', 'Cidade não encontrada. Salve a cidade primeiro.', 'error');
        return;
    }

    // Mude para usar o novo campo ID
    const floorId = document.getElementById('floorIdInput').value.trim();
    const floorLabel = document.getElementById('floorLabel').value.trim();
    const rooms = document.getElementById('floorRooms').value.split('\n')
        .map(room => room.trim())
        .filter(room => room.length > 0);
    const printers = document.getElementById('floorPrinters').value.split('\n')
        .map(printer => printer.trim())
        .filter(printer => printer.length > 0);

    // Validações
    if (!floorId) {
        Swal.fire('Erro', 'O ID do andar é obrigatório', 'error');
        return;
    }

    if (!/^\d+$/.test(floorId)) {
        Swal.fire('Erro', 'O ID do andar deve conter apenas números (ex: 6, 5, 4)', 'error');
        return;
    }

    if (!floorLabel) {
        Swal.fire('Erro', 'O nome do andar é obrigatório', 'error');
        return;
    }

    const floorData = {
        id: floorId,
        label: floorLabel,
        rooms: rooms,
        printers: printers
    };

    try {
        if (editingFloorIndex === -1) {
            const response = await fetch(`/api/cities/${selectedCityIndex}/floors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(floorData)
            });

            const result = await response.json();

            if (result.success) {
                addFloorToForm(floorData, currentData.cities[selectedCityIndex].floors.length);
                Swal.fire('Sucesso!', 'Andar adicionado com sucesso', 'success');
            } else {
                Swal.fire('Erro', result.message, 'error');
                return;
            }
        } else {
            const response = await fetch(`/api/cities/${selectedCityIndex}/floors/${editingFloorIndex}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(floorData)
            });

            const result = await response.json();

            if (result.success) {
                const floorElement = document.querySelector(`.floor-item[data-index="${editingFloorIndex}"]`);
                if (floorElement) {
                    floorElement.querySelector('strong').textContent = floorLabel;
                    floorElement.querySelector('small').textContent =
                        `${rooms.length} salas, ${printers.length} impressoras`;
                }
                Swal.fire('Sucesso!', 'Andar atualizado com sucesso', 'success');
            } else {
                Swal.fire('Erro', result.message, 'error');
                return;
            }
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('floorModal'));
        modal.hide();

    } catch (error) {
        console.error('Erro ao salvar andar:', error);
        Swal.fire('Erro', 'Não foi possível salvar o andar', 'error');
    }
}


async function deleteFloor(floorIndex) {
    if (floorIndex < 0 || selectedCityIndex < 0) {
        removeFloorFromForm(floorIndex);
        return;
    }

    const floorName = currentData.cities[selectedCityIndex].floors[floorIndex].label;

    const result = await Swal.fire({
        title: 'Tem certeza?',
        text: `Esta ação removerá o andar "${floorName}" e todas as suas salas e impressoras!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, deletar!',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/cities/${selectedCityIndex}/floors/${floorIndex}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                removeFloorFromForm(floorIndex);
                Swal.fire('Deletado!', data.message, 'success');
                loadData();
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao deletar andar:', error);
            Swal.fire('Erro', 'Não foi possível deletar o andar', 'error');
        }
    }
}


async function saveCity() {
    const cityName = document.getElementById('cityName').value.trim();

    if (!cityName) {
        Swal.fire('Erro', 'Digite o nome da cidade', 'error');
        return;
    }

    const cityData = {
        name: cityName,
        floors: []
    };


    if (selectedCityIndex >= 0) {
        cityData.floors = [...currentData.cities[selectedCityIndex].floors];
    }

    try {
        let response;
        if (selectedCityIndex === -1) {

            response = await fetch('/api/cities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cityData)
            });
        } else {

            response = await fetch(`/api/cities/${selectedCityIndex}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cityData)
            });
        }

        const result = await response.json();

        if (result.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('cityModal'));
            modal.hide();
            Swal.fire('Sucesso!', result.message, 'success');
            loadData();


            if (selectedCityIndex === -1) {

                const newData = await fetch('/api/data').then(r => r.json());
                const newCityIndex = newData.cities.findIndex(city => city.name === cityName);
                if (newCityIndex !== -1) {
                    setTimeout(() => editCity(newCityIndex), 500);
                }
            }
        } else {
            Swal.fire('Erro', result.message, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar cidade:', error);
        Swal.fire('Erro', 'Não foi possível salvar a cidade', 'error');
    }
}


async function deleteCity(cityIndex) {
    const cityName = currentData.cities[cityIndex].name;

    const result = await Swal.fire({
        title: 'Tem certeza?',
        text: `Esta ação removerá a cidade "${cityName}" e todos os seus andares!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, deletar!',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/cities/${cityIndex}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Deletado!', data.message, 'success');
                loadData();
            } else {
                Swal.fire('Erro', data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao deletar cidade:', error);
            Swal.fire('Erro', 'Não foi possível deletar a cidade', 'error');
        }
    }
}


function manageFloors(cityIndex) {
    selectedCityIndex = cityIndex;
    editCity(cityIndex);
}


function selectTreeItem(type, cityIndex, floorIndex = null) {
    if (type === 'city') {
        selectedCityIndex = cityIndex;
        selectedFloorIndex = -1;
        editCity(cityIndex);
    } else if (type === 'floor') {
        selectedCityIndex = cityIndex;
        selectedFloorIndex = floorIndex;
        openEditFloorModal(floorIndex);
    }
    renderTreeView();
}